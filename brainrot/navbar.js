const nav = document.createElement('div');
nav.className = 'nav';
nav.innerHTML = `
  <a href="memeverzum.html">🌀 Memeverzum</a>
  <a href="gptpropaganda.html">🤖 GPT Propaganda</a>
  <a href="chaosgallery.html">🎨 Káosz Galéria</a>
  <a href="finalschizo.html">🚨 Végső Schizo Zóna</a>
`;

const container = document.getElementById('navbar');
if (container) {
  container.appendChild(nav);
} else {
  console.warn('Navbar container not found.');
}
