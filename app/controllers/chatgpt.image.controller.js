const Clarifai = require('clarifai');
require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');

const clientId = process.env.FATSECREAT_CLIENT_ID;
const clientSecret = process.env.FATSECREAT_CLIENT_SECRET;
const baseUrl = process.env.FATSECREAT_BASE_URL;
//api id for image processing
const app = new Clarifai.App({
  apiKey: process.env.CLARIFAY_API_KEY,
});

//api_id for neutrition website (US department of aggreculture)
const apiKey = process.env.NEUTRITION_API_KEY;

//how sure is the api it detected the meal
const threshold = process.env.NEUTRITION_THRESHOLD;

function nutritionImageSearch(foodName) {
  const encodedFoodName = encodeURIComponent(foodName);
  const url = `${process.env.NEUTRITION_BASE_URL}?query=${encodedFoodName}&pageSize=1&api_key=${apiKey}`;

  return axios
    .get(url)
    .then((response) => {
      const { foods } = response.data;
      const { description: name, servingSize } = foods[0];
      const nutrients = {
        calories: findNutrientValue(foods, 'Energy'),
        fat: findNutrientValue(foods, 'Total lipid (fat)'),
        protein: findNutrientValue(foods, 'Protein'),
        carbs: findNutrientValue(foods, 'Carbohydrate, by difference'),
      };
      const nutritionInfo = { name, servingSize, ...nutrients };
      return nutritionInfo;
    })
    .catch((error) => {
      throw new Error(error.message);
    });
}

function findNutrientValue(foods, nutrientName) {
  const nutrient = foods[0].foodNutrients.find((nutrient) => nutrient.nutrientName === nutrientName);
  return nutrient?.value;
}

exports.getImageResult = async (req, res) => {
  if (req.body.imageUrl) {
    app.models
      .predict(Clarifai.FOOD_MODEL, req.body.imageUrl)
      .then((response) => {
        const foodNames = response.outputs[0].data.concepts
          .filter((concept) => concept?.name !== undefined && concept.value >= threshold)
          .map((concept) => concept.name);
        console.log(foodNames);
        const nutritionInfoPromises = foodNames.map((foodName) => {
          return nutritionImageSearch(foodName);
        });
        return Promise.all(nutritionInfoPromises)
          .then((nutritionInfoList) => {
            const totalNutrition = nutritionInfoList.reduce(
              (acc, curr) => {
                const servingSize = curr.servingSize || 10;
                acc.totalCalories += (curr.calories || 0) * (servingSize / 100);
                acc.totalFat += (curr.fat || 0) * (servingSize / 100);
                acc.totalProtein += (curr.protein || 0) * (servingSize / 100);
                acc.totalCarbs += (curr.carbs || 0) * (servingSize / 100);
                return acc;
              },
              { totalCalories: 0, totalFat: 0, totalProtein: 0, totalCarbs: 0 }
            );

            // eslint-disable-next-line no-console
            console.log(`Total calories: ${totalNutrition.totalCalories}`);
            console.log(`Total fat: ${totalNutrition.totalFat}`);
            console.log(`Total protein: ${totalNutrition.totalProtein}`);
            console.log(`Total carbs: ${totalNutrition.totalCarbs}`);

            return { items: totalNutrition, ingredients: foodNames };
          })
          .catch((error) => {
            throw new Error(error.message);
          });
      })
      .then((data) => {
        return res.status(200).send(data);
      })
      .catch((err) => {
        return res.status(500).send({
          message: err.message,
        });
      });
  } else {
    if (!req.query.foodName) {
      return res.status(500).send({ errors: 'No Image or Food Name provided' });
    }
    const nutritionInfo = await getNutritionInfo(req.query.foodName)
    return res.send({ items: nutritionInfo });
  }
};


async function getNutritionInfo(foodName) {
  try {
    // Get an access token using OAuth 2.0 client credentials flow
    const authUrl = 'https://oauth.fatsecret.com/connect/token';
    const searchUrl =`https://platform.fatsecret.com/rest/server.api?method=foods.search&format=json&search_expression=${foodName}`
    const authData = {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'basic'
    };
    const authResponse = await axios.post(authUrl, querystring.stringify(authData));
    const accessToken = authResponse.data.access_token;
    const requestData = {
      search_expression: foodName,
      format: 'json',
    };

    const response = await axios.post(searchUrl,requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const {food } = response.data?.foods
    console.log(food)

    return {...food}
  } catch (error) {
    console.error(error);
    throw new Error('Error getting nutrition info from FatSecret API');
  }
}