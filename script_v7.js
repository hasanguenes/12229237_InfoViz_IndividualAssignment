// -------- INITIALIZING DATA --------
d3.csv("./vis_data.csv", d => {
  return {
    neighborhood: d.neighbourhood_cleansed,
    price: +d.price
  }
}).then(data => {
    console.log("Data loaded:");
    console.log(data);
  
    // get all neighborhoods sorted by alphabetical order
    const allNeighborhoods = Array.from(new Set(data.map(d => d.neighborhood))).sort(d3.ascending);
    // initial neighborhood is first one
    const initialNeighborhood = allNeighborhoods[0];

    console.log("Initial Neighborhood:", initialNeighborhood);

    // fill dropdown options with all neighborhoods
    d3.select("#selectButton")
      .selectAll('option')
      .data(allNeighborhoods)
      .enter()
      .append('option')
        .text(d => d)
        .attr("value", d => d);

    // set dropdown value to first neighborhood in data
    d3.select("#selectButton").property("value", initialNeighborhood);

    // create bar chart
    createBarChart(data, initialNeighborhood);
});

// -------- CREATING / UPDATING BAR CHART --------

const createBarChart = (data, initialNeighborhood) => {
    
    // --- LOCAL LAYOUT PARAMETERS AND CONSTANTS ---
    const width = 1200, height = 500;
    const margins = {top: 30, right: 30, bottom: 70, left: 60};

    const duration = 2000; // for transisiton of plot
    const padding = 0.5; // for padding between bars
    const innerWidth = width - margins.left - margins.right; // width of grid lines
    const ax_title_font = "22px"; // defines title font size of axis
    
    const lowerLimit = 0;
    const upperLimit = 500;
    //const overflowLimit = 500; // defines last bin including all prices over this value
    const binWidth = 50; // deifnes prices range of one bin

    // --- binning ---
    const bin = d3.bin()
        .domain([lowerLimit, upperLimit])
        .thresholds(d3.range(lowerLimit, upperLimit, binWidth));

    // helper function for computing bins for a specific neighborhood
    function computeBinsForNeighborhood(neighborhood) {
        const filtered = data.filter(d => d.neighborhood === neighborhood);
        const pricesInRange = filtered.map(d => d.price).filter(p => p <= upperLimit);
        const bins = bin(pricesInRange);
        // counting airnbnbs with price > upperLimit
        const overflowCount = filtered.filter(d => d.price > upperLimit).length;
        
        // manually adding last bin for overflow values
        bins.push({ 
            x0: upperLimit, 
            x1: Infinity, 
            length: overflowCount 
        });

        return bins;
    }

    // --- SVG / AXES / BINS ---
    const svg = d3.select("#bar")
        .append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("class", "largeChart"); 
    
    // Initial Bins
    const initialBins = computeBinsForNeighborhood(initialNeighborhood);
    
    // defining categories for bins once, since they do not change
    const categories = initialBins.map(d => {
        if (!isFinite(d.x1)) return `> ${upperLimit}`;
        if (d.x1 == upperLimit) return `${d.x0} - ${d.x1}`;
        return `${d.x0} - ${d.x1 - 1}`;
    });

    // scales 
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([margins.left, width - margins.right])
        .padding(padding); // sets padding between bars

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(initialBins, d => d.length)]).nice() 
        .range([height - margins.bottom, margins.top]);

    // initializing groups for bars, axes, grid
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
    
    // x-axis
    xAxisG.call(d3.axisBottom(xScale));

    // y-axis and grid lines
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

    // configuring / adjusting axis and grid
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
        
    // setting initial value of dynamic title of x-axis
    const xAxisTitle = xAxisG.append("text")
        .attr("x", width / 2)
        .attr("y", margins.bottom - 10) 
        .attr("text-anchor", "middle")
        .attr("class", "axis-label x-axis-title") 
        .style("font-size", ax_title_font)
        .text(`Price per Night ($) in ${initialNeighborhood}`);
        
    // setting static title of y-axis
    yAxisG.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)  
        .attr("y", -margins.left + 18) 
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .style("font-size", ax_title_font)
        .text("Number of Airbnb Listings");

    // --- INITIAL PLOTTING OF BAR CHART ---
    let bar = barsG.selectAll("rect")
        .data(initialBins, (d, i) => categories[i]) 
        .join("rect")
            .attr("x", (d, i) => xScale(categories[i]))
            .attr("width", xScale.bandwidth())
            .attr("y", d => yScale(d.length)) 
            .attr("height", d => yScale(0) - yScale(d.length)) 
            .attr("fill", "steelblue");

    // Setting tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")

    // binding of event listeners to bars (for tooltip)
    bar.on("mouseover", mouseover)
       .on("mouseout", mouseout);

    
    // helper function for creating tooltips at mouseover event
    function mouseover(event, d) {
        let categoryLabel;
        if (d.x1 > upperLimit) {
            categoryLabel = `> ${upperLimit} $`;
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
    
    // helper function for removing tooltips at mouseout event
    function mouseout(event, d) {
        tooltip.style("visibility", "hidden");
        d3.select(this)
            .attr("stroke", null);
    }
    
    // --- SETTING EVENT LISTENER ---

    // when user selects new neighborhood in dropdown menu
    d3.select("#selectButton").on("change", function() {
        
        updateChart(); // char needs to be updated when new neighborhood selected
    });

    // To get the bars to the foreground (otherwise grid lines crossing the bars can be seen)
    barsG.raise();

    // --- UPDATE FUNCTION FOR EVENTS ---

    function updateChart() {
        // get selected neighborhood
        const neighborhood = d3.select("#selectButton").property("value");
        console.log("Selected Neighborhood:", neighborhood);

        // prepare data
        const bins = computeBinsForNeighborhood(neighborhood);
        const t = d3.transition().duration(duration);

        // 2. update y-domain and grids
        const maxCount = d3.max(bins, d => d.length) || 0;
        yScale.domain([0, maxCount]).nice();
        const maxTicks = Math.min(maxCount, 10);

        // update y axis and grid lines
        yAxisG.transition(t)
            .call(d3.axisLeft(yScale)
            .ticks(maxTicks)
            .tickFormat(d3.format("d")));

        yGridG.transition(t)
            .call(d3.axisLeft(yScale)
            .ticks(maxTicks)
            .tickSize(-innerWidth)
            .tickFormat(""));
        
        // remove grid line at y = 0 
        yGridG.selectAll(".tick")
            .filter(d => d === 0)
            .select("line")
            .remove();

        // remove domain of grid lines
        yGridG.select(".domain")
            .remove();
        
        // 3. update bars ( enter / update / exit)
        bar = barsG.selectAll("rect")
            .data(bins, (d, i) => categories[i]) 
            .join(
                // ENTER (enter new bars appearing)
                enter => enter.append("rect")
                    .attr("x", (d, i) => xScale(categories[i]))
                    .attr("width", xScale.bandwidth())
                    .attr("y", yScale(0)) // start at y = 0
                    .attr("height", 0) // start with height = 0
                    .attr("fill", "steelblue")
                    .call(enter => enter.transition(t)
                        .attr("y", d => yScale(d.length)) // go to end position
                        .attr("height", d => yScale(0) - yScale(d.length)) // go to end-height
                    ),
                
                // UPDATE (existing bars change height / position)
                update => update.transition(t)
                    .attr("x", (d, i) => xScale(categories[i])) // normally I would not need this line because x-position stays the same
                    .attr("width", xScale.bandwidth()) // normally I would not need this line because x-width stays the same
                    .attr("y", d => yScale(d.length)) 
                    .attr("height", d => yScale(0) - yScale(d.length)), 
                
                // normally I could remove this and just constantly update
                // EXIT (Remove not needed bars)
                exit => exit.transition(t)
                    .attr("y", yScale(0)) // go to y = 0
                    .attr("height", 0) // set height to 0
                    .remove()
            );

        // update title of x-axis
        xAxisTitle.text(`Price per Night ($) in ${neighborhood}`);
    }
};