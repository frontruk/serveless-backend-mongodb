const Util = require('/opt/nodejs/util');
const SharedUtil = require('/opt/nodejs/shared-func');
const uuidv4 = require('uuid/v4');
const websiteTable = Util.getTableName('website');
const userTable = Util.getTableName('user');
const pageTable = Util.getTableName('page');
module.exports = {
    async login(event) {
        const paramsUserId = event.queryStringParameters.userId;

        const authenticatedUser = await SharedUtil.getUserByUsername(paramsUserId);
        if (!authenticatedUser || authenticatedUser.Count === 0) {
            return Util.envelop({ message : 'We can\'t find you.'}, 404);
        }
        const userWebsites = await SharedUtil.getUserWebsite(authenticatedUser.Items[0].id)
        if (userWebsites.Count === 0) {
            return Util.envelop({ message : 'You don\'t have any websites'}, 422);
        }
        if (userWebsites.Count > 1) {
            return Util.envelop({
                user: authenticatedUser,
                dashboard: 'www.sembler.io/dashboard'
            });
        }

        const intialPage = await SharedUtil.getPageById(userWebsites.Items[0].init_pageId.id);
        return Util.envelop({
            user: authenticatedUser.Items[0],
            website: userWebsites.Items[0],
            page: intialPage.Item,
            // components: components.Items[0]
        });
    },
    async create(event) {
        const userData = JSON.parse(event.body);
        const userWithThisEmail = await SharedUtil.getUserByUsername(userData.username);
        if (userWithThisEmail.Count !== 0) {
            return Util.envelop(`Email already taken: [${user.email}]`, 422);
        }
        const user = {
            id: uuidv4(),
            username: userData.username,
        };
        console.log(event.body);
        console.log(user);
        await Util.DocumentClient.put({
            TableName: userTable,
            Item: user,
        }).promise();

        const pageId = uuidv4();
        const website = {
            id: uuidv4(),
            name: `Site`,
            subDomain: `${user.id}.sembler.io`,
            enable_domain: false,
            status: 'unpublished',
            init_pageId: {
                id: pageId,
                name: 'Home',
                path: '/home',
            },
            userId: user.id,
            protocol_https: false,
            order: 1
        };

        await Util.DocumentClient.put({
            TableName: websiteTable,
            Item: website,
        }).promise();

        const page = {
            id: pageId,
            name: 'Home',
            path: '/home',
            websiteId: `${website.id}`,
            order: 1,
            userId: `${user.id}`
        };
        await Util.DocumentClient.put({
            TableName: pageTable,
            Item: page,
        }).promise();
        return Util.envelop({
            user: user,
            website:website,
            page:page
        });
    },
    async get(event) {
        console.log('event', event)
        const authenticatedUser = await SharedUtil.authenticateAndGetUser(event);
        console.log('authenticatedUser', authenticatedUser)
        if (!authenticatedUser) {
            return Util.envelop('Token not present or invalid.', 422);
        }
        return Util.envelop({
            user: authenticatedUser
        });
    },
    async update(event) {
        const authenticatedUser = await SharedUtil.authenticateAndGetUser(event);
        if (!authenticatedUser) {
            return Util.envelop({message: 'Must be logged in.'}, 422);
        }
        const body = JSON.parse(event.body);
        const user  = body.user;
        if (!user) {
            return Util.envelop('User must be specified.', 422);
        }
        const updatedUser = {
            id: authenticatedUser.id,
            username: authenticatedUser.username,
        };
        if (user.username && user.username !== authenticatedUser.username) {
            // Verify email is not taken
            const userWithThisEmail = await SharedUtil.getUserByUsername(user.username);
            if (userWithThisEmail.Count !== 0) {
                return Util.envelop(`Email already taken: [${user.username}]`, 422);
            }
            updatedUser.username = user.username;
        }
        if (user.firstName) {
            updatedUser.firstName =  user.firstName;
        }
        if (user.lastName) {
            updatedUser.lastName =  user.lastName;
        }
        if (user.primaryWebsite) {
            updatedUser.primaryWebsite =  user.primaryWebsite;
        }

        await Util.DocumentClient.put({
            TableName: userTable,
            Item: updatedUser,
        }).promise();

        return Util.envelop({user: updatedUser});
    },
};
