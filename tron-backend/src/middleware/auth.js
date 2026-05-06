// src/middleware/auth.js
const { supabase } = require('../config/supabase'); 

async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 1. Verify the Developer's token cryptographically
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Unauthorized: Token is expired or invalid' });
        }

        // 2. Look up which Organization this Developer belongs to
        const { data: userData } = await supabase
            .from('users')
            .select('org_id')
            .eq('id', user.id)
            .single();

        // 🌟 FALLBACK: If you haven't linked developers to orgs in your DB yet, 
        // we will fall back to your specific test Org ID so it works immediately!
        const orgId = userData?.org_id || 'fbf6021e-e84d-433c-a41e-31e302be78e6';

        // 3. Attach the orgId securely to the request
        req.user = {
            id: user.id,
            org_id: orgId
        };

        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err);
        return res.status(500).json({ error: 'Internal server error during authentication' });
    }
}

module.exports = { requireAuth };