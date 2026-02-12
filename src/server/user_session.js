const config = require("../../configLoader.js");
const fs = require("fs");
const logic = require("../../logic.js");

let userSession = {
    language: 'en'
};

module.exports = {
    session: userSession,

    updateFromQuery: (request) => {
        if(request.query?.language){
            userSession['language'] = request.query?.language;
        }
    },

    getLangLabels: async () => {
        let langFile = `${require.main.path}/${config.folders.assets}/languages/${userSession.language}.json`;
        if (!fs.existsSync(langFile)) {
            langFile = `${config.folders.assets}/languages/en.json`;
        }
        return await logic.getFile(langFile, true);
    }
}
