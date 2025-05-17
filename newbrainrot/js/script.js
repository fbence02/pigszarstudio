function playSound() {
  const audio = new Audio('assets/audio/mamma-mia.mp3');
  audio.play();
}

// Random pizzák lebegtetése (később beépíthető)
document.addEventListener('DOMContentLoaded', () => {
  for (let i = 0; i < 10; i++) {
    const img = document.createElement('img');
    img.src = 'assets/images/pizza.png';
    img.classList.add('floating-pizza');
    img.style.left = Math.random() * window.innerWidth + 'px';
    img.style.top = Math.random() * window.innerHeight + 'px';
    document.body.appendChild(img);
  }
});
