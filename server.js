const express = require("express");
const bodyParser = require("body-parser");

const cors = require("cors");
const mongo = require("mongodb");
const mongoose = require("mongoose");

var Schema = mongoose.Schema;

mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const app = express();
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

const userSchema = new Schema({
  username: String,
  exercises: [Object],
});

const User = mongoose.model("User", userSchema);

app.get("/api/exercise/users", (req, res, next) => {
  User.find({}, (err, links) => {
    if (err) return next(err);
    res.json(
      links.map((link) => {
        const { username, _id, exercises } = link;
        return { username, _id, exercises };
      })
    );
  });
});

app.post("/api/exercise/new-user", (req, res, next) => {
  const { body } = req;
  const { username } = body;
  const newUser = new User({ username, exercises: [] });

  newUser.save(function (err, data) {
    if (err) return next(err);
    const { _id } = data;
    res.json({ username, _id });
  });
});

app.post("/api/exercise/add", (req, res, next) => {
  const { body } = req;
  const { userId, description, duration, date } = body;
  var newDate = new Date();
  const newExercise = {
    description,
    duration,
    date: date ? date : newDate.toISOString().split("T")[0],
  };
  User.findByIdAndUpdate(
    userId,
    {
      $push: {
        exercises: newExercise,
      },
    },
    function (err, data) {
      if (err) return next(err);
      if (data) {
        data.exercises.push(newExercise);
        res.json(data);
      }
    }
  );
});

app.get("/api/exercise/log", (req, res, next) => {
  const { query } = req;
  const { userId, from, to, limit } = query;

  User.findById(userId, (err, data) => {
    if (err) return next(err);
    const { username, exercises, _id } = data;
    const filtered = to && from ? dateHelper(from, to, exercises) : false;
    let log = filtered && filtered.length > 0 ? filtered : exercises;
    let count =
      filtered && filtered.length > 0 ? filtered.length : exercises.length;
    if (limit) {
      count = limit;
      log = log.slice(0, Number(limit));
    }
    res.json({
      username,
      exercises,
      _id,
      log,
      count,
    });
  });
});

function dateHelper(from, to, exercises) {
  var from = new Date(from);
  var to = new Date(to);
  return exercises.filter((exercise) => {
    const { date } = exercise;
    const rawDate = new Date(date);
    return rawDate >= from && rawDate <= to;
  });
}

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res.status(errCode).type("txt").send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
