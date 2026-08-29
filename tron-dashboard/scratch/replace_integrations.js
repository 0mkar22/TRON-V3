const fs = require('fs');
const file = 'src/app/integrations/page.jsx';
const content = fs.readFileSync(file, 'utf8');

const marker = '// 🌟 RENDER UI';
const idx = content.indexOf(marker);
if (idx === -1) throw new Error("Marker not found");

const prefix = content.slice(0, idx + marker.length);

const brutalistJSX = `
    return (
        <div className="p-8 max-w-7xl mx-auto font-sans">
            <h1 className="text-5xl font-black uppercase mb-8 border-b-8 border-black pb-4 text-black">Integrations Hub</h1>
            
            {params?.installation_id && params?.github_setup !== 'success' && (
                <div className="bg-brutal-orange border-4 border-black p-6 mb-8 shadow-brutal flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-2xl uppercase text-black">Finish GitHub Setup</h3>
                        <p className="font-mono font-bold text-black mt-2">GitHub authorized TRON. Finalize connection.</p>
                    </div>
                    <form action={finalizeGitHubSetup}>
                        <input type="hidden" name="installationId" value={params.installation_id} />
                        <button type="submit" className="btn-brutal bg-white px-6 py-4 text-xl text-black">FINALIZE</button>
                    </form>
                </div>
            )}

            {params?.github_error && (
                <div className="bg-brutal-pink border-4 border-black p-6 mb-8 shadow-brutal">
                    <h3 className="font-black text-2xl uppercase text-black">GitHub Connection Failed</h3>
                    <p className="font-mono font-bold text-black bg-white border-2 border-black p-2 mt-2 break-all">{params.github_error}</p>
                </div>
            )}

            {params?.github_setup === 'success' && (
                <div className="bg-brutal-green border-4 border-black p-6 mb-8 shadow-brutal">
                    <h3 className="font-black text-2xl uppercase text-black">GitHub App Connected Successfully</h3>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* GITHUB */}
                <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="p-4 border-b-4 border-black bg-brutal-green">
                        <h2 className="text-3xl font-black uppercase text-black">GITHUB</h2>
                    </div>
                    <div className="p-6 flex-grow">
                        <p className="font-mono font-bold text-black">STATUS: {github ? 'CONNECTED' : 'DISCONNECTED'}</p>
                    </div>
                    <div className="p-6 pt-0 mt-auto">
                        {github ? (
                            <form action={deleteIntegration}>
                                <input type="hidden" name="provider" value="github" />
                                <button type="submit" className="w-full btn-brutal bg-brutal-pink text-black text-xl py-4">DISCONNECT</button>
                            </form>
                        ) : (
                            <a href="https://github.com/apps/tron-v3-1/installations/new" className="block w-full btn-brutal bg-white text-black text-xl py-4 text-center">CONNECT</a>
                        )}
                    </div>
                </div>

                {/* JIRA */}
                <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="p-4 border-b-4 border-black bg-brutal-blue">
                        <h2 className="text-3xl font-black uppercase text-black">JIRA</h2>
                    </div>
                    <div className="p-6 flex-grow space-y-4">
                        <p className="font-mono font-bold text-black mb-4">STATUS: {jira ? 'CONNECTED' : 'DISCONNECTED'}</p>
                        {!jira && (
                            <form action={saveIntegration} className="space-y-4">
                                <input type="hidden" name="provider" value="jira" />
                                <input name="baseUrl" type="url" required placeholder="https://your-domain.atlassian.net" className="input-brutal text-black" />
                                <input name="email" type="email" required placeholder="admin@acmecorp.com" className="input-brutal text-black" />
                                <input name="apiToken" type="password" required placeholder="Jira API Token" className="input-brutal text-black" />
                                <button type="submit" className="w-full btn-brutal bg-white text-black text-xl py-4">CONNECT</button>
                            </form>
                        )}
                        {jira && (
                            <form action={deleteIntegration} className="mt-auto">
                                <input type="hidden" name="provider" value="jira" />
                                <button type="submit" className="w-full btn-brutal bg-brutal-pink text-black text-xl py-4">DISCONNECT</button>
                            </form>
                        )}
                    </div>
                </div>

                {/* SLACK */}
                <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="p-4 border-b-4 border-black bg-brutal-orange">
                        <h2 className="text-3xl font-black uppercase text-black">SLACK</h2>
                    </div>
                    <div className="p-6 flex-grow space-y-4">
                        <p className="font-mono font-bold text-black mb-4">STATUS: {slack ? 'CONNECTED' : 'DISCONNECTED'}</p>
                        {!slack && (
                            <form action={saveIntegration} className="space-y-4">
                                <input type="hidden" name="provider" value="slack" />
                                <input name="token" type="password" required placeholder="Webhook URL" className="input-brutal text-black" />
                                <button type="submit" className="w-full btn-brutal bg-white text-black text-xl py-4">CONNECT</button>
                            </form>
                        )}
                        {slack && (
                            <form action={deleteIntegration} className="mt-auto">
                                <input type="hidden" name="provider" value="slack" />
                                <button type="submit" className="w-full btn-brutal bg-brutal-pink text-black text-xl py-4">DISCONNECT</button>
                            </form>
                        )}
                    </div>
                </div>
                
                {/* DISCORD */}
                <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="p-4 border-b-4 border-black bg-brutal-pink">
                        <h2 className="text-3xl font-black uppercase text-black">DISCORD</h2>
                    </div>
                    <div className="p-6 flex-grow space-y-4">
                        <p className="font-mono font-bold text-black mb-4">STATUS: {discord ? 'CONNECTED' : 'DISCONNECTED'}</p>
                        {!discord && (
                            <form action={saveIntegration} className="space-y-4">
                                <input type="hidden" name="provider" value="discord" />
                                <input name="token" type="password" required placeholder="Bot Token" className="input-brutal text-black" />
                                <button type="submit" className="w-full btn-brutal bg-white text-black text-xl py-4">CONNECT</button>
                            </form>
                        )}
                        {discord && (
                            <form action={deleteIntegration} className="mt-auto">
                                <input type="hidden" name="provider" value="discord" />
                                <button type="submit" className="w-full btn-brutal bg-brutal-pink text-black text-xl py-4">DISCONNECT</button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
`;

fs.writeFileSync(file, prefix + brutalistJSX);
