import express from "express";

const app = express();

const port = process.env.PORT || 3000;

import userRoutes from "./routes/userRoutes";

import adminRoutes from "./routes/adminRoutes";

var cors = require("cors");
app.use(cors());

app.use(express.json());

app.get("/", (req, res) => res.send("this is home page!"));

app.use("/user", userRoutes);

app.use("/admin", adminRoutes);

app.listen(port, () => console.log(`app listening on port ${port}!`));
