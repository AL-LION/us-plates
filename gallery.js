async function showGallery() {
  const state = new URLSearchParams(window.location.search).get("state");
  const heading = document.querySelector("#state-name");
  const gallery = document.querySelector("#gallery");

  if (!state) {
    heading.textContent = "State not specified";
    gallery.textContent = "Return to the map and select a state.";
    return;
  }

  heading.textContent = `${state} license plates`;
  document.title = `${state} plates | Plate World`;

  try {
    const plates = await d3.csv("data/plates.csv");
    const statePlates = plates.filter(
      plate => plate.state.trim() === state
    );

    if (statePlates.length === 0) {
      gallery.textContent = "No plate images added yet.";
      return;
    }

    for (const plate of statePlates) {
      const figure = document.createElement("figure");
      const image = document.createElement("img");

      image.src = plate.image.trim();
      image.alt = plate.description.trim();
      image.loading = "lazy";

      if (plate.source?.trim()) {
        const link = document.createElement("a");
        link.href = plate.source.trim();
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute(
          "aria-label",
          `View source for ${plate.description.trim()}`
        );
        link.append(image);
        figure.append(link);
      } else {
        figure.append(image);
      }

      gallery.append(figure);
    }
    
  } catch (error) {
    gallery.textContent = `Could not load plate images: ${error.message}`;
    console.error(error);
  }
}

showGallery();