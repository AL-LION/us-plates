async function drawMap() {
  const status = document.querySelector("#status");

  try {
    const [atlas, rows, plates] = await Promise.all([
      d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
      d3.csv("data/counts.csv"),
      d3.csv("data/plates.csv")
    ]);

    const states = topojson.feature(atlas, atlas.objects.states).features

    const stateNames = new Set(
      states.map(state => state.properties.name)
    );

    const counts = new Map();
    const firstSeen = new Map();

    for (const [index, row] of rows.entries()) {
      const name = row.state?.trim();
      const rawCount = row.count?.trim();
      const line = index + 2; // Line 1 contains the CSV headings.

      if (!stateNames.has(name)) {
        throw new Error(`CSV line ${line}: "${name}" is not a recognized state.`);
      }

      if (!/^\d+$/.test(rawCount)) {
        throw new Error(
          `CSV line ${line}: count for ${name} must be a whole number of 0 or more.`
        );
      }

      if (counts.has(name)) {
        throw new Error(`CSV line ${line}: ${name} appears more than once.`);
      }

      counts.set(name, Number(rawCount));
      const date = row.first_seen?.trim() || "";

      if (date) {
        const parsed = d3.utcParse("%Y-%m-%d")(date);

        if (!parsed || d3.utcFormat("%Y-%m-%d")(parsed) !== date) {
          throw new Error(
            `CSV line ${line}: first_seen for ${name} must be a valid YYYY-MM-DD date.`
          );
        }

        firstSeen.set(name, date);
      }
    }

    const featuredPlates = new Map();

    for (const [index, plate] of plates.entries()) {
      const state = plate.state?.trim();
      const featured = plate.featured?.trim().toLowerCase();
      const line = index + 2;

      if (!stateNames.has(state)) {
        throw new Error(`Plates CSV line ${line}: "${state}" is not a recognized state.`);
      }

      if (featured !== "" && featured !== "yes") {
        throw new Error(`Plates CSV line ${line}: featured must be "yes" or blank.`);
      }

      if (featured === "yes") {
        if (featuredPlates.has(state)) {
          throw new Error(`Plates CSV line ${line}: ${state} has two featured plates.`);
        }

        if (!plate.image?.trim()) {
          throw new Error(`Plates CSV line ${line}: featured plate has no image path.`);
        }

        featuredPlates.set(state, plate);
      }
    }

    const width = 975;
    const height = 610;

    const projection = d3.geoAlbersUsa()
      .fitSize([width - 20, height - 20], {
        type: "FeatureCollection",
        features: states
      });

    const path = d3.geoPath(projection);
    const highestCount = Math.max(1, ...counts.values());

    const legend = document.querySelector("#map-legend");
        legend.replaceChildren();

        const title = document.createElement("span");
        title.className = "legend-title";
        title.textContent = "Seen";

        const blocks = document.createElement("div");
        blocks.className = "legend-blocks";

        const ranges = [
          ["0", "#E0E0E0"],
          ["1", "#E9F7E1"],
          ["2", "#c7e9c0"],
          ["3–6", "#74c476"],
          ["7–9", "#31a354"],
          ["10+", "#006d2c"]
        ];    
    for (const [label, fill] of ranges) {
      const block = document.createElement("span");
      block.style.backgroundColor = fill;
      block.setAttribute("aria-label", `${label}  `);
      blocks.append(block);
    }

    const labels = document.createElement("div");
    labels.className = "legend-labels";
    labels.innerHTML = "<span>0</span><span>10+</span>";

    legend.append(title, blocks, labels);
    legend.hidden = false;

    const color = d3.scaleThreshold()
      .domain([2, 3, 4, 7, 10])
      .range([
        "#E9F7E1",
        "#c7e9c0",
        "#74c476",
        "#31a354",
        "#006d2c"
      ]);

    const svg = d3.select("#map")
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "group")
      .attr("aria-label", "US states shaded by license plate sightings");

    const preview = document.querySelector("#plate-preview");

    function showPreview(event, state) {
      const name = state.properties.name;
      const count = counts.get(name) ?? 0;
      const plate = featuredPlates.get(name);

      preview.replaceChildren();

      const label = document.createElement("strong");
      label.textContent = `${name === "District of Columbia" ? "DC" : name}: ${count} seen`;
      preview.append(label);

      const date = firstSeen.get(name);

      if (date) {
        const firstSeenText = document.createElement("div");
        const [year, month, day] = date.split("-").map(Number);

        firstSeenText.textContent =
           `First seen: ${month}/${day}/${String(year).slice(-2)}`;

        preview.append(firstSeenText);
      }

      if (plate) {
        const image = document.createElement("img");
        image.src = plate.image.trim();
        image.alt = plate.description.trim();
        preview.append(image);
      }

      preview.hidden = false;
      movePreview(event);
    }

    function movePreview(event) {
      const gap = 16;
      const left = Math.min(
        event.clientX + gap,
        window.innerWidth - preview.offsetWidth - gap
      );
      const top = Math.min(
        event.clientY + gap,
        window.innerHeight - preview.offsetHeight - gap
      );

      preview.style.left = `${Math.max(gap, left)}px`;
      preview.style.top = `${Math.max(gap, top)}px`;
    }

    svg.selectAll("path")
      .data(states)
      .join("path")
      .attr("d", path)
      .attr("fill", state => {
        if (state.properties.name === "Maryland") return "#EDA932";
        const count = counts.get(state.properties.name) ?? 0;
        return count === 0 ? "#E0E0E0" : color(count);
      })  
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .attr("tabindex", 0)
      .attr("role", "link")
      .attr("aria-label", state => {
        const name = state.properties.name;
        const count = counts.get(name) ?? 0;
        return `${name}, ${count} seen${count === 1 ? "" : "s"}. Open plate gallery.`;
      })
      .on("focus", function (event, state) {
        const bounds = this.getBoundingClientRect();

        showPreview(
          {
            clientX: bounds.left + bounds.width / 2,
            clientY: bounds.top + bounds.height / 2
          },
          state
        );
      })
      .on("blur", () => {
        preview.hidden = true;
      })
      .on("keydown", (event, state) => {
        if (event.key === "Enter") {
          window.location.href =
            `state.html?state=${encodeURIComponent(state.properties.name)}`;
        }
      })
      .on("mouseenter", showPreview)
      .on("mousemove", movePreview)
      .on("mouseleave", () => {
        preview.hidden = true;
      })
      .on("click", (_, state) => {
        window.location.href =
          `state.html?state=${encodeURIComponent(state.properties.name)}`;
  });

  const dc = states.find(
  state => state.properties.name === "District of Columbia"
);

const dcPosition = projection([-77.0369, 38.9072]);

if (dc && dcPosition) {
  const [x, y] = dcPosition;
  const count = counts.get("District of Columbia") ?? 0;

  const dcMarker = svg.append("g")
    .attr("class", "dc-marker")
    .attr("role", "link")
    .attr("tabindex", 0)
    .attr(
      "aria-label",
      `District of Columbia, ${count} seen. Open plate gallery.`
    );

  dcMarker.append("circle")
    .attr("class", "dc-marker-hit-area")
    .attr("cx", x)
    .attr("cy", y)
    .attr("r", 9);

  dcMarker.append("circle")
    .attr("class", "dc-marker-dot")
    .attr("cx", x)
    .attr("cy", y)
    .attr("r", 6)
    .attr("fill", count === 0 ? "#E0E0E0" : color(count));

  dcMarker
    .on("mouseenter", event => showPreview(event, dc))
    .on("mousemove", movePreview)
    .on("mouseleave", () => {
      preview.hidden = true;
    })
    .on("focus", () => {
      const bounds = dcMarker.node().getBoundingClientRect();
      showPreview(
        {
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top + bounds.height / 2
        },
        dc
      );
    })
    .on("blur", () => {
      preview.hidden = true;
    })
    .on("click", () => {
      window.location.href = "state.html?state=District%20of%20Columbia";
    })
    .on("keydown", event => {
      if (event.key === "Enter") {
        window.location.href = "state.html?state=District%20of%20Columbia";
      }
    });
}

    status.hidden = true;
  } catch (error) {
    status.textContent = `Could not draw the map: ${error.message}`;
    console.error(error);
  }
}

drawMap();