const jwt = require('jsonwebtoken');
const axios = require('axios');

class GitHubAppAdapter {
    // 1. Generate the JWT to prove we are the TRON App
    static generateAppJWT() {
        const appId = process.env.GITHUB_APP_ID;
        // Handle newline characters if stored in an environment variable
        const privateKey = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');

        const payload = {
            iat: Math.floor(Date.now() / 1000) - 60, // Issued 60 seconds ago (handles clock drift)
            exp: Math.floor(Date.now() / 1000) + (10 * 60), // Expires in 10 minutes
            iss: appId
        };

        // Sign it securely using RSA
        return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    }

    // 2. Exchange the JWT for a temporary Installation Token
    static async getInstallationToken(installationId) {
        if (!installationId) throw new Error("Missing GitHub Installation ID");
        try {
            const appJwt = this.generateAppJWT();
            
            const response = await axios.post(
                `https://api.github.com/app/installations/${installationId}/access_tokens`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${appJwt}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );
            
            // This token is what you use instead of the old PAT!
            return response.data.token; 
        } catch (error) {
            console.error("❌ Failed to generate GitHub Installation Token:", error.response?.data || error.message);
            throw new Error("GitHub App Auth Failed");
        }
    }
}

module.exports = GitHubAppAdapter;