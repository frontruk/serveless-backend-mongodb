const Util = require('/opt/nodejs/util');
const SharedUtil = require('/opt/nodejs/shared-func');
const uuidv4 = require('uuid/v4');

const websiteTable = Util.getTableName('website');
const userTable = Util.getTableName('user');
const pageTable = Util.getTableName('page');
const componentsTable = Util.getTableName('components');
const jwt = require('jsonwebtoken');

module.exports = {
    async get(event) {
        const getRequest = SharedUtil.getRequestObj(event);
        const authenticatedUser = await SharedUtil.authenticateAndGetUser(event);
        if (!authenticatedUser) {
            return Util.envelop('Must be logged in.', 422);
        }
        const website = await SharedUtil.getUserWebsiteByRequestForDomain(authenticatedUser.id, getRequest.requestOrigin );
        if (website.Count >= 2) {
            return Util.envelop('System error, domain and Subdomain same domain', 500);
        }
        if (website.Count === 0) {
            return Util.envelop('We are not able to find a website by request', 500);
        }
        return Util.envelop({
            website: website.Items[0]
        });
    },
    async create(event) {
        const newWebsite = JSON.parse(event.body);
        const authenticatedUser = await SharedUtil.authenticateAndGetUser(event);
        if (!authenticatedUser) {
            return Util.envelop('Must be logged in.', 422);
        }
        const pageId = uuidv4();
        let website = {
            id: uuidv4(),
            init_pageId: {
                id: pageId,
                name: 'Home',
                path: '/home',
            },
            userId: authenticatedUser.id
        };
        console.log(website, newWebsite);
        website = { ...website, ...newWebsite };



        await Util.DocumentClient.put({
            TableName: websiteTable,
            Item: website,
        }).promise();

        const page = {
            id: pageId,
            name: 'Home',
            path: '/home',
            websiteId: `${website.id}`,
            userId: `${authenticatedUser.id}`
        };
        await Util.DocumentClient.put({
            TableName: pageTable,
            Item: page,
        }).promise();

        return Util.envelop({
            website:website,
            page:page
        });
    },
    async update(event) {
        const body = JSON.parse(event.body);
        const websiteMutation = body.website;
        if (!websiteMutation) {
            return Util.envelop('website mutation must be specified.', 422);
        }

        // Ensure at least one mutation is requested
        if (!websiteMutation.id &&
            !websiteMutation.name && !websiteMutation.enable_domain) {
            return Util.envelop(
                'At least one field must be specified: [id, name, enable_domain].',
                422);
        }

        const authenticatedUser = await SharedUtil.authenticateAndGetUser(event);
        if (!authenticatedUser) {
            return Util.envelop('Must be logged in.', 422);
        }

        // TODO does this get all properties for this object?
        const website = (await Util.DocumentClient.get({
            TableName: websiteTable,
            Key: { id:  websiteMutation.id },
        }).promise()).Item;

        if (!website) {
            return Util.envelop(`website not found: [${websiteMutation.id }]`, 422);
        }
        const user = await SharedUtil.getUserByUsername(authenticatedUser.username);

        if (website.userId !== user.Items[0].id) {
            return Util.envelop('Website can only be updated by author: ', 422);
        }

        console.log('website:', website)
        console.log('website:', websiteMutation)

        const updatedWebsite =  {
            ...website,
            ...websiteMutation
        };

        console.log('website--->', updatedWebsite)

        // console.log('user', user.Items[0] );
        // console.log('website ---->', website.userId !== user.Items[0].id);
        // Ensure website is authored by authenticatedUser

        await Util.DocumentClient.put({
            TableName: websiteTable,
            Item: updatedWebsite,
        }).promise();

        return Util.envelop({
            website: updatedWebsite
        });
    },
    async getwebsites(event) {
        const authenticatedUser = await SharedUtil.authenticateAndGetUser(event);
        if (!authenticatedUser) {
            return Util.envelop('Must be logged in.', 422);
        }
        const websites = await SharedUtil.getUserWebsite(authenticatedUser.id);
        if (websites.Count === 0) {
            return Util.envelop('We are not able to find a website by request', 500);
        }
        return Util.envelop({
            websites: websites.Items
        });
    },
};

