const galleryNature = document.querySelector(".container-prompt");
const contador = document.querySelector("#contador");

let likes = JSON.parse(localStorage.getItem("likes")) || [];
let totalLikes = likes.length;

contador.textContent = totalLikes;
async function fetchGallery() {
    try {
      const response = await fetch(
            `https://api.unsplash.com/search/photos?query=nature&per_page=30&client_id=${API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}`);
        }

        const data = await response.json();

        galleryNature.innerHTML = "";
        
        data.results.forEach((image) => {

            const button = document.createElement("button");
            button.textContent = "♥";

            if (likes.includes(image.id)) {
                button.classList.add("liked");
            }

            button.addEventListener("click", () => {
                darLike(button, image.id);
            });
          
            const galleryElement = document.createElement("div");
            galleryElement.classList.add("gallery-item");

            const galleryImage = document.createElement("img");
            galleryImage.src = image.urls.small;
            galleryImage.alt = image.alt_description || "Nature Image";

            const galleryTitle = document.createElement("h3");
            galleryTitle.textContent = image.alt_description || "Nature";

            galleryElement.appendChild(galleryImage);
            galleryElement.appendChild(button);
            
            galleryNature.appendChild(galleryElement);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

fetchGallery();

function darLike(button) {
    button.classList.toggle("liked");
}

function darLike(button) {

    if (button.classList.contains("liked")) {
        button.classList.remove("liked");
        totalLikes--;
    } else {
        button.classList.add("liked");
        totalLikes++;
    }

    contador.textContent = totalLikes;
}

function darLike(button, id) {

    if (button.classList.contains("liked")) {

        button.classList.remove("liked");
        likes = likes.filter(likeId => likeId !== id);

    } else {

        button.classList.add("liked");
        likes.push(id);
    }

    totalLikes = likes.length;
    contador.textContent = totalLikes;

    localStorage.setItem("likes", JSON.stringify(likes));
}

