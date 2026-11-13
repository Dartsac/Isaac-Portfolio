document.addEventListener('DOMContentLoaded', () => {
  // Select elements
  const lottiePlayer = document.querySelector('.apple-animation');
  const title = document.querySelector('.title');
  const grain = document.querySelector('.grain');

  // Hide the typewriter text initially
  title.style.opacity = '0';

  // Wait for the Lottie animation to complete
  lottiePlayer.addEventListener('complete', () => {
    // Show the typewriter text and start the animation
    title.style.opacity = '1';
    title.classList.add('typewriter');

    // Wait for the typewriter effect to complete, then show grain effect
    setTimeout(() => {
      grain.classList.add('show-grain');
    }, 1500); // Adjust based on the duration of the typewriter animation
  });
});
