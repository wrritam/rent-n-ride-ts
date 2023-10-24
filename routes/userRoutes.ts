import express from "express";
const router = express.Router();
import jwt from "jsonwebtoken";
import { sendMail } from "../helper/sendMail";
import { authentication } from "../middlewares/auth";

import prisma from "../DB/db.config";

//USER SIGNUP

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email } });
  if (user) {
    res.status(403).json({ message: "User already exists" });
  } else {
    const newUser = await prisma.user.create({
      data: {
        name: name,
        email: email,
        password: password,
      },
    });
    const token = jwt.sign(
      { email, role: "user", name },
      process.env.hiddenKey as string,
      {
        expiresIn: "1h",
      }
    );
    res.json({ message: "User created successfully", token });
  }
});

//USER LOGIN

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({
    where: {
      email: email,
      password: password,
    },
  });
  if (user) {
    const name = user.name;
    const token = jwt.sign(
      { email, role: "user", name },
      process.env.hiddenKey as string,
      {
        expiresIn: "24h",
      }
    );
    res.json({ message: "Logged in successfully", token });
  } else {
    res.status(403).json({ message: "Invalid email or password" });
  }
});

router.post("/forgotPassword", async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });
  if (user) {
    const secret = process.env.hiddenKey + user.password;
    const payload = {
      email: user.email,
      id: user.id,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "15m" });
    const modifiedToken = token.replace(/\./g,'&');
    const content = `
      <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=MonteCarlo&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: 'Montserrat', sans-serif, Arial, sans-serif;">
          <div style="max-width: 600px; margin: auto auto; padding: 20px; background-color: rgba(255, 255, 255, 0.4); border-radius: 6px;">
            <img src="template/email-logo.svg" alt="Your Logo Alt Text" style="display: block; margin: 0; width: 10vw;">
            <p style="font-size: 40px;">Hello,</p>
            <p style="margin: 5px 0; padding: 0;">Please click the following link to reset your password:</p>
            <a href="https://rent-ride-three.vercel.app/user/reset-password/${user.id}/${modifiedToken}" style="text-align: center; display: block; margin: 10px auto; padding: 10px 20px; background-color: rgb(16, 185, 129); color: #fff; text-decoration: none; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s ease;">Reset Password</a>
          </div>
        </body>
      </html>`;
    //sendMail(email, "Reset Password", link);
    res.send(sendMail(email, "Reset Password", content));
    //res.status(200).json({ message: "reset link sent" });
  } else {
    res.status(402).json({ message: "User doesnt reside in our database" });
  }
});

router.post("/resetPassword/:id/:token", async (req, res) => {
  const { id, token } = req.params;
  const { password, confirmPassword } = req.body;
  console.log(token)
  const originalToken = token.replace(/\&/g, '.');
  console.log(originalToken)
  const user = await prisma.user.findUnique({
    where: {
      id: parseInt(id),
    },
  });

  if (user) {
    const secret = process.env.hiddenKey + user.password;
    try {
      const payload = jwt.verify(originalToken, secret);
      if (password === confirmPassword) {
        await prisma.user.update({
          where: {
            id: parseInt(id),
          },
          data: {
            password: password,
          },
        });
        res.send("password updated successfully");
      } else {
        res.send("passwords do not match");
      }
    } catch (error) {
      res.status(404).json(error);
    }
  }
});

//GET ALL MODELS

router.get("/inventory", authentication, async (req, res) => {
  const models = await prisma.model.findMany({
    where: { published: true },
  });
  res.json({ models });
});

// GET BY BRANDS

router.get("/cars/brands/:id", authentication, async (req, res) => {
  const id = parseInt(req.params.id);
  const car = await prisma.cars.findMany({
    where: { id: id },
  });
  try {
    res.json({ car });
  } catch (error: any) {
    res.json({ error });
  }
});

//GET A SINGLE CAR

router.get("/car/:id", authentication, async (req, res) => {
  const id = parseInt(req.params.id);
  const model = await prisma.model.findUnique({
    where: { id: id },
  });
  try {
    res.json({ model });
  } catch (error: any) {
    res.json({ error });
  }
});

// RENT A CAR

router.post("/rent-car/:id", authentication, async (req, res) => {
  const { startDate, endDate, status } = req.body;
  const id = parseInt(req.params.id);
  const car = await prisma.model.findUnique({
    where: {
      id: id,
    },
  });
  console.log(car);
  if (car) {
    const user = await prisma.user.findUnique({
      where: {
        email: req.user.email,
      },
    });
    if (user) {
      const carID = car.id;
      const userID = user.id;
      const rentedCar = await prisma.rentedCar.create({
        data: {
          carId: carID,
          rentedtoId: userID,
          startDate: startDate,
          endDate: endDate,
          status: status,
        },
      });
      const rentedCarID = rentedCar.id;
      const token = jwt.sign(
        { id: rentedCarID },
        process.env.hiddenKey as string,
        {
          expiresIn: "24h",
        }
      );
      res.json({ message: "Car Rented successfully", token });
    } else {
      res.status(403).json({ message: "User not found" });
    }
  } else {
    res.status(404).json({ message: "Car not found" });
  }
});

// UPDATING STATUS FOR CHECKING

router.put("/statusCheck/:id", authentication, async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const targetCar = await prisma.rentedCar.findUnique({
    where: { id: id },
  });
  if (targetCar) {
    const carId = targetCar.id;
    await prisma.rentedCar.update({
      where: { id: carId },
      data: {
        status: status,
      },
    });
    res.json({ message: "Car checked successfully" });
  } else {
    res.status(404).json({ message: "Car not found" });
  }
});

// GET RENTED CARS
router.get("/rentedCars", authentication, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: {
      email: req.user.email,
    },
    include: {
      onRent: {
        where: {
          status: true,
        },
      },
    },
  });
  if (user) {
    res.json({ rentedCars: user.onRent });
  } else {
    res.status(403).json({ message: "User not found" });
  }
});

//PUT IT IN WISHLIST

router.post("/wishlist/:id", authentication, async (req, res) => {
  const id = parseInt(req.params.id);
  const car = await prisma.model.findUnique({ where: { id: id } });
  console.log(car);
  if (car) {
    const user = await prisma.user.findUnique({
      where: {
        email: req.user.email,
      },
    });
    if (user) {
      const userID = user.id;
      const carID = car.id;
      await prisma.wishlistedCar.create({
        data: {
          wishlistedbyId: userID,
          carId: carID,
        },
      });
      //await user.save();
      res.json({ message: "Ride is in your wishlist" });
    } else {
      res.status(403).json({ message: "User not found" });
    }
  } else {
    res.status(404).json({ message: "Car not found" });
  }
});

//GET WISHLISTED CARS

router.get("/wishlistedCar", authentication, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: {
      email: req.user.email,
    },
    include: {
      onWishlist: true,
    },
  });
  if (user) {
    res.json({ wishlistedCar: user.onWishlist || [] });
  } else {
    res.status(403).json({ message: "User not found" });
  }
});

//REMOVE IT FROM WISHLIST

router.delete("/wishlistedCar/:id", authentication, async (req, res) => {
  const wishCar = await prisma.wishlistedCar.findUnique({
    where: { id: parseInt(req.params.id) },
  });
  console.log(wishCar);
  if (wishCar) {
    const user = await prisma.user.findUnique({
      where: { email: req.user.email },
      include: {
        onWishlist: true,
      },
    });
    if (user) {
      const wishCarId = wishCar.id;
      await prisma.wishlistedCar.delete({
        where: {
          id: wishCarId,
        },
      });
      res.json({
        message: "Car removed from wishlist",
      });
    } else {
      res.status(403).json({ message: "User Not found" });
    }
  } else {
    res.status(404).json({ message: "Car Not Found" });
  }
});

export default router;
