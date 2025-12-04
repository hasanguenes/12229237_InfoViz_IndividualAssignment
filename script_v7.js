// -------- GLOBALE KONSTANTEN UND TOOLTIP --------

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("visibility", "hidden");  // Startet als unsichtbar

// -------- INITIALIZING DATA --------
d3.csv("./vis_data.csv", d => {
  return {
    neighborhood: d.neighbourhood_cleansed,
    price: +d.price
  }
}).then(data => {
    console.log("Data loaded:");
    console.log(data);
  
    // Alle Nachbarschaften extrahieren und sortieren
    const allNeighborhoods = Array.from(new Set(data.map(d => d.neighborhood))).sort(d3.ascending);
    const initialNeighborhood = allNeighborhoods[0];

    console.log("Initial Neighborhood:", initialNeighborhood);

    // Dropdown füllen
    d3.select("#selectButton")
      .selectAll('option')
      .data(allNeighborhoods)
      .enter()
      .append('option')
        .text(d => d)
        .attr("value", d => d);

    // Set dropdown value to first neighborhood in data
    d3.select("#selectButton").property("value", initialNeighborhood);

    // Initialen Aufruf der Chart-Funktion
    createBarChart(data, initialNeighborhood);
});

// -------- CREATING / UPDATING BAR CHART --------

const createBarChart = (data, initialNeighborhood) => {
    
    // --- LOKALE LAYOUT-VARIABLEN & PARAMETER ---
    const width = 1200, height = 500;
    const margins = {top: 30, right: 30, bottom: 70, left: 60};

    const duration = 2000;
    const padding = 0.5;
    const innerWidth = width - margins.left - margins.right;
    const ax_title_font = "22px";
    
    const lowerLimit = 0;
    const upperLimit = 500;
    const overflowLimit = 520;
    const binWidth = 50;

    // --- Binning-Funktion ---
    const bin = d3.bin()
        .domain([lowerLimit, upperLimit])
        .thresholds(d3.range(lowerLimit, upperLimit, binWidth));

    function computeBinsForNeighborhood(neighborhood) {
        const filtered = data.filter(d => d.neighborhood === neighborhood);
        const pricesInRange = filtered.map(d => d.price).filter(p => p <= upperLimit);
        const bins = bin(pricesInRange);
        const overflowCount = filtered.filter(d => d.price > overflowLimit).length;
        bins.push({ 
            x0: overflowLimit, 
            x1: Infinity, 
            length: overflowCount 
        });
        return bins;
    }

    // --- SVG & Achsen EINMALIG ERSTELLEN ---
    const svg = d3.select("#bar")
        .append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("class", "largeChart"); 
    
    // Initial Bins (für X-Achsen-Labels und Y-Domain)
    const initialBins = computeBinsForNeighborhood(initialNeighborhood);
    const categories = initialBins.map(d => {
        if (!isFinite(d.x1)) return `> ${overflowLimit}`;
        if (d.x1 == upperLimit) return `${d.x0} - ${d.x1}`;
        return `${d.x0} - ${d.x1 - 1}`;
    });

    // Scales (Y-Domain initial setzen)
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([margins.left, width - margins.right])
        .padding(padding);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(initialBins, d => d.length)]).nice() // Initialer Y-Domain
        .range([height - margins.bottom, margins.top]);

    // Achsengruppen initialisieren
    const barsG = svg.append("g")
        .attr("id", "bars");
    const yAxisG = svg.append("g")
        .attr("transform", `translate(${margins.left}, 0)`)
        .attr("class", "axis y-axis");
    const xAxisG = svg.append("g")
        .attr("transform", `translate(0, ${height - margins.bottom})`)
        .attr("class", "axis x-axis");
    const yGridG = svg.append("g")
        .attr("class", "y-grid")
        .attr("transform", `translate(${margins.left}, 0)`);
    
    // X-Achse (statisch)
    xAxisG.call(d3.axisBottom(xScale));

    // Y-Achse und Gitter (Initiales Zeichnen)
    const maxTicksInitial = Math.min(d3.max(initialBins, d => d.length) || 0, 10);
    yAxisG
        .call(d3.axisLeft(yScale)
        .ticks(maxTicksInitial)
        .tickFormat(d3.format("d")));
    yGridG
        .call(d3.axisLeft(yScale)
        .ticks(maxTicksInitial)
        .tickSize(-innerWidth)
        .tickFormat(""));

    // Achsen-Anpassungen
    xAxisG
        .selectAll(".tick text")
        .style("text-anchor", "middle")
        .attr("dy", "1em");
    yGridG
        .selectAll(".tick")
        .filter(d => d === 0)
        .select("line").remove();
    yGridG
        .select(".domain")
        .remove();
        
    // X-Achsen Titel (Initial)
    const xAxisTitle = xAxisG.append("text")
        .attr("x", width / 2)
        .attr("y", margins.bottom - 10) 
        .attr("text-anchor", "middle")
        .attr("class", "axis-label x-axis-title") 
        .style("font-size", ax_title_font)
        .text(`Price per Night ($) in ${initialNeighborhood}`);
        
    // Y-Achsen Titel (statisch)
    yAxisG.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)  
        .attr("y", -margins.left + 18) 
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .style("font-size", ax_title_font)
        .text("Number of Airbnb Listings");

    // ----------------------------------------------------------------------
    // --- INITIALES ZEICHNEN DER BALKEN (wie im Beispielcode) ---
    // ----------------------------------------------------------------------
    
    let bar = barsG.selectAll("rect")
        .data(initialBins, (d, i) => categories[i]) 
        .join("rect")
            .attr("x", (d, i) => xScale(categories[i]))
            .attr("width", xScale.bandwidth())
            .attr("y", d => yScale(d.length)) 
            .attr("height", d => yScale(0) - yScale(d.length)) 
            .attr("fill", "steelblue");


    // Tooltip-Handler initial binden (damit sie auch vor dem Update funktionieren)
    bar.on("mouseover", mouseover)
       .on("mouseout", mouseout);

    
    // Hilfsfunktionen für Tooltips (nutzen Closure auf lokale Variablen)
    function mouseover(event, d) {
        let categoryLabel;
        if (d.x1 > overflowLimit) {
            categoryLabel = `> ${overflowLimit} $`;
        } else if (d.x1 == upperLimit) {
            categoryLabel = `${d.x0} - ${d.x1} $`; 
        } else {
            categoryLabel = `${d.x0} - ${d.x1 - 1} $`; 
        }

        tooltip 
            .style("visibility", "visible")
            .html(`${categoryLabel}: ${d.length} Airbnb Listings`)
            .style("top", (event.pageY + 0) + "px")
            .style("left", (event.pageX + 10) + "px");

        d3.select(this)
            .attr("stroke", "black")
            .attr("stroke-width", 3);
    }
    
    function mouseout(event, d) {
        tooltip.style("visibility", "hidden");
        d3.select(this)
            .attr("stroke", null);
    }
    
        
    // ----------------------------------------------------------------------
    // --- EVENT LISTENER (INITIIERT UPDATES) ---
    // ----------------------------------------------------------------------

    d3.select("#selectButton").on("change", function() {
        
        updateChart(); // Ruft die innere, lokale Funktion auf
    });

    // Tooltip-Handler sind bereits gebunden und nutzen die Closure-Variablen
    barsG.raise();

        // ----------------------------------------------------------------------
    // --- INNERE UPDATE-FUNKTION (für Events) ---
    // ----------------------------------------------------------------------

    function updateChart() {
        // Get selected neighborhood
        const neighborhood = d3.select("#selectButton").property("value");
        console.log("Selected Neighborhood:", neighborhood);

        // 1. DATEN VORBEREITEN
        const bins = computeBinsForNeighborhood(neighborhood);
        const t = d3.transition().duration(duration);

        // 2. Y-DOMAIN & ACHSEN AKTUALISIEREN
        const maxCount = d3.max(bins, d => d.length) || 0;
        yScale.domain([0, maxCount]).nice();
        const maxTicks = Math.min(maxCount, 10);

        // Y-Achse und Grid aktualisieren
        yAxisG.transition(t)
            .call(d3.axisLeft(yScale)
            .ticks(maxTicks)
            .tickFormat(d3.format("d")));

        yGridG.transition(t)
            .call(d3.axisLeft(yScale)
            .ticks(maxTicks)
            .tickSize(-innerWidth)
            .tickFormat(""));
        
        // Gitterlinie bei y=0 entfernen und Domain-Linie der Grid-Achse entfernen (nach der Transition)
        yGridG.selectAll(".tick")
            .filter(d => d === 0)
            .select("line")
            .remove();

        yGridG.select(".domain")
            .remove();


        // 3. BARS AKTUALISIEREN (UPDATE-SELEKTION)
        // barsG.selectAll("rect") // Wir nutzen die existierende Selektion
        //     .data(bins, (d, i) => categories[i]) 
        //     .transition(t)
        //         .attr("x", (d, i) => xScale(categories[i])) 
        //         .attr("width", xScale.bandwidth())
        //         .attr("y", d => yScale(d.length)) 
        //         .attr("height", d => yScale(0) - yScale(d.length));
        
        // 3. BARS AKTUALISIEREN (VOLLER JOIN-Zyklus mit Enter/Update/Exit)
        bar = barsG.selectAll("rect") // <--- Wichtig: Selektion erneut ausführen
            .data(bins, (d, i) => categories[i]) 
            .join(
                // ENTER-Phase (Neue Balken erscheinen von der Y=0 Linie)
                enter => enter.append("rect")
                    .attr("x", (d, i) => xScale(categories[i]))
                    .attr("width", xScale.bandwidth())
                    .attr("y", yScale(0)) // Startet bei Null-Linie
                    .attr("height", 0) // Startet mit Höhe Null
                    .attr("fill", "steelblue")
                    .call(enter => enter.transition(t)
                        .attr("y", d => yScale(d.length)) // End-Position
                        .attr("height", d => yScale(0) - yScale(d.length)) // End-Höhe
                    ),
                
                // UPDATE-Phase (Existierende Balken wechseln die Höhe/Position)
                update => update.transition(t)
                    .attr("x", (d, i) => xScale(categories[i])) 
                    .attr("width", xScale.bandwidth())
                    .attr("y", d => yScale(d.length)) 
                    .attr("height", d => yScale(0) - yScale(d.length)), 
                
                // zur vollsätndigkeit halber gemacht, aber normal ist das egal
                // EXIT-Phase (Nicht mehr benötigte Balken verschwinden)
                exit => exit.transition(t)
                    .attr("y", yScale(0)) // Geht zur Null-Linie
                    .attr("height", 0) // Höhe wird auf Null gesetzt
                    .remove() // Element entfernen
            );

        // 4. TITEL AKTUALISIEREN
        xAxisTitle.text(`Price per Night ($) in ${neighborhood}`);
        
        // 5. TOOLTIPS AKTUALISIEREN (muss nach dem Join neu gebunden werden)
        //bar.on("mouseover", mouseover).on("mouseout", mouseout);

        // Tooltip-Handler sind bereits gebunden und nutzen die Closure-Variablen
        //barsG.raise();
    }
};

// TODO: clean code + correct documentation + try to understand + documenting use of gen ai + schau ob du auch den originalen datset includen sollst