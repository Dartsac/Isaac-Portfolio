const tl = gsap.timeline({ defaults: { ease: 'power1.out' } })

tl.to('.lottie-bg', { display: 'none', duration: 1, delay: 1.8 })
tl.fromTo('.title', { opacity: 0 }, { opacity: 1, duration: 0.1 })

// let animation = lottie.loadAnimation({
//
//   rendererSettings: {
//     preserveAspectRatio: 'xMidYMid slice'
//
//   }
// });
