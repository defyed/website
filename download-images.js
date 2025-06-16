const fs = require('fs');
const path = require('path');
const https = require('https');

// Define directories
const lolChampionsDir = path.join(__dirname, 'public', 'images', 'champions');
const valorantAgentsDir = path.join(__dirname, 'public', 'images', 'agents');

// Create directories if they don't exist
if (!fs.existsSync(lolChampionsDir)) fs.mkdirSync(lolChampionsDir, { recursive: true });
if (!fs.existsSync(valorantAgentsDir)) fs.mkdirSync(valorantAgentsDir, { recursive: true });

// Valorant agents list
const valorantAgents = [
    'Astra', 'Breach', 'Brimstone', 'Chamber', 'Clove', 'Cypher', 'Deadlock', 'Fade', 'Gekko', 'Harbor',
    'Iso', 'Jett', 'KAY/O', 'Killjoy', 'Neon', 'Omen', 'Phoenix', 'Raze', 'Reyna', 'Sage',
    'Skye', 'Sova', 'Viper', 'Vyse', 'Yoru'
];

// Sanitize filename to replace invalid characters
function sanitizeFileName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Download file from URL
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', err => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

// Get latest Data Dragon version
async function getLatestDdragonVersion() {
    try {
        const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const versions = await response.json();
        return versions[0]; // Latest version
    } catch (error) {
        console.error(`Error fetching Data Dragon version: ${error.message}`);
        return '15.12.1'; // Fallback
    }
}

// Get LoL champion IDs
async function getLolChampions(ddragonVersion) {
    try {
        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return Object.keys(data.data).map(key => ({
            id: key,
            name: data.data[key].name
        }));
    } catch (error) {
        console.error(`Error fetching LoL champions: ${error.message}`);
        return [];
    }
}

// Download LoL champion images
async function downloadLolChampions() {
    const ddragonVersion = await getLatestDdragonVersion();
    console.log(`Using Data Dragon version: ${ddragonVersion}`);
    const champions = await getLolChampions(ddragonVersion);
    if (!champions.length) {
        console.error('No champions found. Exiting.');
        return;
    }
    for (const champion of champions) {
        const fileName = sanitizeFileName(champion.name) + '.png';
        const dest = path.join(lolChampionsDir, fileName);
        if (fs.existsSync(dest)) {
            console.log(`Skipping ${fileName} (already exists)`);
            continue;
        }
        const url = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champion.id}.png`;
        try {
            await downloadFile(url, dest);
            console.log(`Downloaded ${fileName}`);
        } catch (error) {
            console.error(`Error downloading ${fileName}: ${error.message}`);
        }
    }
}

// Download Valorant agent images
async function downloadValorantAgents() {
    try {
        const response = await fetch('https://valorant-api.com/v1/agents');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const agents = data.data.filter(agent => agent.isPlayableCharacter);
        for (const agent of agents) {
            const name = agent.displayName;
            if (!valorantAgents.includes(name)) continue;
            const fileName = sanitizeFileName(name) + '.png';
            const dest = path.join(valorantAgentsDir, fileName);
            if (fs.existsSync(dest)) {
                console.log(`Skipping ${fileName} (already exists)`);
                continue;
            }
            const url = agent.displayIcon;
            try {
                await downloadFile(url, dest);
                console.log(`Downloaded ${fileName}`);
            } catch (error) {
                console.error(`Error downloading ${fileName}: ${error.message}`);
            }
        }
    } catch (error) {
        console.error(`Error fetching Valorant agents: ${error.message}`);
    }
}

// Run downloads
async function main() {
    console.log('Downloading LoL champion images...');
    await downloadLolChampions();
    console.log('Downloading Valorant agent images...');
    await downloadValorantAgents();
    console.log('Download complete!');
}

main().catch(console.error);