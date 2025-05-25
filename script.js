const galleries = {
  gallery1: [
    "./images/gallery/1.png",
    "./images/gallery/2.png",
    "./images/gallery/3.png",
    "./images/gallery/4.png",
    "./images/gallery/5.png",
    "./images/gallery/6.png",
    "./images/gallery/7.png"
  ],
  gallery2: [
    "./images/gallery/8.png",
    "./images/gallery/9.png",
    "./images/gallery/10.png",
    "./images/gallery/11.png",
    "./images/gallery/12.png",
    "./images/gallery/13.png"
  ],
  gallery3: [
    "./images/gallery/14.png",
    "./images/gallery/15.png",
    "./images/gallery/16.png",
    "./images/gallery/17.png",
    "./images/gallery/18.png"
  ],
  gallery4: [
    "./images/gallery/19.png",
    "./images/gallery/20.png",
    "./images/gallery/21.png",
    "./images/gallery/22.png",
    "./images/gallery/23.png",
    "./images/gallery/24.png",
    "./images/gallery/25.png",
    "./images/gallery/26.png"
  ]
};

const currentIndexes = {};

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".lapozo").forEach((carousel) => {
    const galleryName = carousel.dataset.gallery;
    const imgElement = carousel.querySelector("img");
    const prevBtn = carousel.querySelector(".prev");
    const nextBtn = carousel.querySelector(".next");

    // Ha nincs még index, akkor 0
    currentIndexes[galleryName] = 0;

    // Kezdő kép beállítása
    imgElement.src = galleries[galleryName][0];

    prevBtn.addEventListener("click", () => {
      currentIndexes[galleryName] =
        (currentIndexes[galleryName] - 1 + galleries[galleryName].length) %
        galleries[galleryName].length;
      imgElement.src = galleries[galleryName][currentIndexes[galleryName]];
    });

    nextBtn.addEventListener("click", () => {
      currentIndexes[galleryName] =
        (currentIndexes[galleryName] + 1) % galleries[galleryName].length;
      imgElement.src = galleries[galleryName][currentIndexes[galleryName]];
    });
  });
});

