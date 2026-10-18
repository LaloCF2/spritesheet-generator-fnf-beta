const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('index.html', 'utf8');
const lines = src.split('\n');

// Find boundaries
const b_home = lines.findIndex(l => l.includes('id="win-home"'));
const b_escaner = lines.findIndex(l => l.includes('id="win-escaner"'));
const b_orden = lines.findIndex(l => l.includes('id="win-orden"'));
const b_afinador = lines.findIndex(l => l.includes('id="win-afinador"'));
const b_psych = lines.findIndex(l => l.includes('id="win-psych"'));
const b_compresor = lines.findIndex(l => l.includes('id="win-compresor"'));
const b_audio = lines.findIndex(l => l.includes('id="win-audio"'));
const b_atlas = lines.findIndex(l => l.includes('id="win-atlas"'));
const b_footer = lines.findIndex(l => l.includes('id="welcomeModal"'));

// Extract chunks
const header = lines.slice(0, b_home).join('\n');
const home = lines.slice(b_home, b_escaner).join('\n');
const escaner = lines.slice(b_escaner, b_orden).join('\n');
const orden = lines.slice(b_orden, b_afinador).join('\n');
const afinador = lines.slice(b_afinador, b_psych).join('\n');
const psych = lines.slice(b_psych, b_compresor).join('\n');
const compresor = lines.slice(b_compresor, b_audio).join('\n');
const audio = lines.slice(b_audio, b_atlas).join('\n');
const atlas = lines.slice(b_atlas, b_footer).join('\n');
let footer = lines.slice(b_footer).join('\n');

// Clean up Header Nav Links to return to index.html instead of changing classes
let newHeader = header.replace(
    /onclick="openWindow\('win-home'\)"/g, 
    `onclick="window.location.href='index.html'"`
);

// We need a helper to generate a file
function makeFile(filename, appMode, includeWindows, initWindow) {
    let content = newHeader;
    
    for (let win of includeWindows) {
        content += '\n' + win;
    }
    
    // Add initialization script right before closing body
    let script = `
    <script>
        appMode = '${appMode}';
        if (typeof toggleNavButtons === 'function') toggleNavButtons();
        if (typeof openWindow === 'function') openWindow('${initWindow}');
    </script>
    `;
    
    let currentFooter = footer;
    currentFooter = currentFooter.replace('</body>', script + '\n</body>');
    
    content += '\n' + currentFooter;
    
    fs.writeFileSync(filename, content);
    console.log("Created " + filename);
}

makeFile('escaner.html', 'SCAN', [escaner, orden, afinador], 'win-escaner');
makeFile('optimizador.html', 'EDIT', [orden, afinador], 'win-orden');
makeFile('psych.html', 'PSYCH', [psych], 'win-psych');
makeFile('compresor.html', 'COMPRESS', [compresor], 'win-compresor');
makeFile('audio.html', 'AUDIO', [audio], 'win-audio');
makeFile('atlas.html', 'ATLAS', [atlas], 'win-atlas');

// Now for index.html, we only want the Home window
// We also need to change the onclick handlers in home window to use location.href
let newHome = home
    .replace(`onclick="initMode('SCAN')"`, `onclick="window.location.href='escaner.html'"`)
    .replace(`onclick="initMode('COMPRESS')"`, `onclick="window.location.href='compresor.html'"`)
    .replace(`onclick="initMode('AUDIO')"`, `onclick="window.location.href='audio.html'"`)
    .replace(`onclick="initMode('ATLAS')"`, `onclick="window.location.href='atlas.html'"`);

let indexContent = newHeader + '\n' + newHome + '\n' + footer;
fs.writeFileSync('index_new.html', indexContent);
console.log("Created index_new.html");
