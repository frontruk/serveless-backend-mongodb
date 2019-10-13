"use strict";
const mongodbUser = {
    username: 'sem-api',
    password: '6iWiuwHr6zfV6iWiuwHr6zfV',
    clusterName: 'Sem-shard',
    dbName: 'sem-mongod'
}
const MongoClient = require('mongodb').MongoClient;
const MONGODB_URI = `mongodb://${mongodbUser.username}:${mongodbUser.password}@${mongodbUser.clusterName}-00-00-wmlp1.mongodb.net:27017,${mongodbUser.clusterName}-00-01-wmlp1.mongodb.net:27017,${mongodbUser.clusterName}-00-02-wmlp1.mongodb.net:27017/${mongodbUser.dbName}?ssl=true&replicaSet=${mongodbUser.clusterName}-0&authSource=admin`;
let cachedDb = null;

async function connectToDatabase (uri) {
    console.log('=> connect to database');

    if (cachedDb) {
        console.log('=> using cached database instance');
        return Promise.resolve(cachedDb);
    }

    return MongoClient.connect(uri, { useNewUrlParser: true })
        .then(db => {
            cachedDb = db.db('sem-mongod');
            return cachedDb;
        })
        .catch(err => {
            console.log('=> an error occurred: ', err);

        });
}

async function queryDatabasefind(db, collectionname, queryparams) {
    console.log('=> query database');

    return db.collection(collectionname).find(queryparams).toArray()
        .then((data) => { return { statusCode: 200, body: data }; })
        .catch(err => {
            console.log('=> an error occurred: ', err);
            return { statusCode: 500, body: 'error' };
        });
}

exports.handler = async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;
    let dns = '', cleanDns = '', path = '';
    var headerOrigin = "origin"
    // returns http://localhost:4200
    var headerReferer = "referer"
    // returns localhost:4200/edit/home

    dns = event.headers[headerOrigin];
    console.log('headers', event.headers[headerOrigin], event.headers[headerReferer])
    cleanDns = event.headers[headerOrigin].includes('https://') ? event.headers[headerOrigin].replace('https://', '') : event.headers[headerOrigin].replace('http://', '');
    // retruns localhost:4200
    if(event.headers[headerReferer].includes('/edit')){
        path = event.headers[headerReferer].replace(event.headers[headerOrigin] + '/edit', '');
    }else{
        path = event.headers[headerReferer].replace(event.headers[headerOrigin], '');
    }

    console.log('path', path)
    // returns /home
    console.log('handlePageEditRoute', dns,cleanDns, path)

    const connectionsDB = await connectToDatabase(MONGODB_URI);
    try {
        const queryWebsites = await queryDatabasefind(connectionsDB, 'websites',
            {
                $or: [
                    { domain: cleanDns },
                    { temp_subdomain: cleanDns }
                ]
            })
        if(!queryWebsites || queryWebsites.length === 0) return { statusCode: 500, body:'can\'t find website by domain'}
        console.log(queryWebsites.body, typeof queryWebsites.body)
        const response = {
            statusCode: 200,
            body: JSON.stringify(queryWebsites.body) // JSON.stringify( createPage),
        };
        callback(null, response )
        return response;
    } catch (error) {
        const response = {
            statusCode: 400,
            body: JSON.stringify({msg: error})// JSON.stringify( createPage),
        };
        callback(null, response )
        return response;
    }
};
