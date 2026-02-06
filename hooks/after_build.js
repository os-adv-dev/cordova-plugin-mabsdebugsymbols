#!/usr/bin/env node

const { exec } = require('child_process');

module.exports = function(context) {
    var fs = require('fs');
    var path = require('path');
    var execSync = require('child_process').execSync;

    // Check if iOS platform is included
    if (!context.opts.platforms || !context.opts.platforms.includes('ios')) {
        console.log('iOS platform not found, skipping dSYM upload.');
        return;
    }

    // Get preferences
    console.log('Retrieving plugin preferences...');
    console.log('Context options:', context.opts);
    var preferences = context.opts.plugin ? context.opts.plugin.preferences : {};
    var endpoint = preferences.ENDPOINT;
    var username = preferences.USERNAME;
    var password = preferences.PASSWORD;

    if (!endpoint || !username || !password) {
        console.error('Missing preferences: ENDPOINT, USERNAME, PASSWORD');
        return;
    }

    // Find dSYM path
    var dsymPath = findDSYM();

    if (!dsymPath) {
        console.error('No dSYM file found in', iosBuildPath);
        return;
    }

    console.log('Found dSYM at:', dsymPath);

    // Zip the dSYM
    var zipPath = path.join(context.opts.projectRoot, 'dsym.zip');
    try {
        execSync(`zip -r "${zipPath}" "${dsymPath}"`, { stdio: 'inherit' });
        console.log('dSYM zipped to:', zipPath);
    } catch (error) {
        console.error('Error zipping dSYM:', error.message);
        return;
    }

    // Upload the zip
    try {
        var uploadCommand = `curl -X POST -u "${username}:${password}" -F "file=@${zipPath}" "${endpoint}"`;
        var result = execSync(uploadCommand, { encoding: 'utf8' });
        console.log('Upload result:', result);
    } catch (error) {
        console.error('Error uploading dSYM:', error.message);
    } finally {
        // Clean up zip file
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }
    }
};

function findDSYM() {
    try {
        var username = execSync(`whoami`, { encoding: 'utf8' }).trim();

        const derivedData = path.join("/Users",username, "Library", "Developer", "Xcode", "DerivedData");
        const projectNameStartsWith = 'MABSDebugSymbolsPluginSample';
        const match = fs.readdirSync(derivedData)
            .find(name => name.startsWith(projectNameStartsWith));
        
        if (!match) {
            return;
        }

        dsymPath = path.join(derivedData, match, "Build", "Intermediates.noindex","ArchiveIntermediates", projectNameStartsWith, "BuildProductsPath", "Debug-iphoneos", projectNameStartsWith + ".app.dSYM");

        return dsymPath;
    } catch (error) {
        console.error('Error logging DerivedData contents:', error.message);
    }
}