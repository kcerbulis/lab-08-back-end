'use strict';

//==========================================
// Configure
//==========================================

require('dotenv').config();

//==========================================
// Global Variables
//==========================================

const PORT = process.env.PORT || 3000;
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

//==========================================
// Postgres client setup
//==========================================

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', error => console.error(error));

//==========================================
// Server Definition
//==========================================
// Express is a web application framework, it helps manage API's routs requests and views
const app = express();
// Cors enables truly open access across domain-boundries
app.use(cors());

//==========================================
// Server
//==========================================

// Switched app.get from an anonymous function to a named callback.
app.get('/location', searchLatLng);

app.get('/weather', searchWeather);

// Standard response for when a route that does not exist is accessed.
app.use('*', (request, response) => {
  response.send('Our server runs.');
})

//==========================================
// Helper Functions
//==========================================

function searchLatLng(request, response) {
  // take the data from the front end, as the searched for location ('berlin')
  const searchQuery = request.query.data;
  console.log('checking the DATABASE');
  client.query('SELECT * FROM location WHERE search_query = $1', [searchQuery])
    .then(result => {
      console.log('result from database');
      if (result.rows.length) {
        console.log('exists in the DATABASE');
        response.send('result.row[0]');
      } else {
        getGoogleInfo(searchQuery, response)
      }
    })

  console.log('searchLatLng query: ', searchQuery);
  const geocodeData = `https://maps.googleapis.com/maps/api/geocode/json?address=${searchQuery}&key=${process.env.GOOGLE_API_KEY}`;

  // Uses the API queary and targets the needed data
  superagent.get(geocodeData).then(locationResult => {
    const first = locationResult.body.results[0];
    console.log('searchLatLng first: ', first);
    const responseObject = new Location(searchQuery, first);
    response.send(responseObject);
  })
}

function getGoogleInfo(searchQuery, response) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${searchQuery}&key=${process.env.GOOGLE_API_KEY}`;
  superagent.get(url).then(result => {
    const location = new Location(searchQuery, result.body.results[0]);
    console.log('from google API: \n', location);
    response.send(location);

    console.log('Table not found. Inserting it into the database.')
    client.query(`INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4)`, [location.search_query, location.formatted_query, location.latitude, location.longitude]);
  })
}

function searchWeather(request, response) {
  const weatherQuery = request.query.data;
  const weatherData = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${weatherQuery.latitude},${weatherQuery.longitude}`;

  superagent.get(weatherData).then(weatherResult => {
    const weeklyWeatherArray = weatherResult.body.daily.data.map(dayObj => new DailyWeather(dayObj.summary, dayObj.time));
    response.send(weeklyWeatherArray);
  })
  // .catch(console.log);
}


//==========================================
// Constructors
//==========================================

function DailyWeather(forecast, time) {
  this.forecast = forecast;
  this.time = new Date(time * 1000).toString().slice(0, 15);
}

function Location(query, data) {
  this.search_query = query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
}

//==========================================

//server start
app.listen(PORT, () => {
  console.log(`app is up on PORT ${PORT}`)
})
