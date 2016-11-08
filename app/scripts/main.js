/*global cytoscape, window */
(function(window, $, cytoscape, undefined) {
	'use strict';

	var appContext = $('[data-app-name="aip-interactions-viewer"]');

	// Variables for graph
	var nodes = [], edges = [], loci = [];

	window.addEventListener('Agave::ready', function() {
		var Agave = window.Agave;	// Agave
		var i = 0; // Counter	

		$(document).ready(function() {
			// These are the layout option. I will work on these
			var layoutOptions = {
				name: 'cose',
				animate: true,
				animationThreshold: 250,
				refresh: 20,
				fit: true,
				padding: 20,
				nodeOverlap: 20,
				gravity: 80,
				numIter: 1000,
				initialTemp: 200,
				coolingFactor: 0.95,
				minTemp: 1.0,
			};

			// This function loads cytoscape. 'elements' stores the newtwork
			function loadCy(elements) {
				// Unhide the legend and link for BAR AIV
				$('#aip-interactions-viewer-legend', appContext).removeClass('hidden');
				$('#aip-interactions-viewer-aiv', appContext).removeClass('hidden');

				// Now load the network
				$('#aip-interactions-viewer-cyto', appContext).removeClass('hidden').cytoscape({
					minZoom: 0.25,
					maxZoom: 4,
					wheelSensitivity: 0.25,
					motionBlur: false,
					layout: layoutOptions,
					style: [
						{
							selector: 'node',
								css: {
									'content': 'data(name)',
									'width': 'data(nWidth)',
									'height': 'data(nHeight)'
								}
						},
						{
							selector: 'edge',
								css: {
									'width': 'data(lineWidth)',
									'line-style': 'data(lineStyle)',
									'line-color': 'data(lineColor)'
								}
						}
					],
					elements: elements
				}); // End .cytoscape()
			} //  End loadCy()

			// Remove white spaces and validate the loci. Return the list of useable loci
			function validateLoci(inputLoci) {
				var finalLoci = [];
				var patt = /^AT(\d|C|M)G\d{5,5}$/i;
				for (var i = 0; i < inputLoci.length; i++) {
					inputLoci[i] = inputLoci[i].trim();
					if (patt.test(inputLoci[i])) {
						// Add to list if it is not aleardy there
						if (finalLoci.indexOf(inputLoci[i]) === -1) {
							finalLoci.push(inputLoci[i]);
						}
					}
				}
				return finalLoci;
			}

			// Reset button
			$('#aip-interactions-viewer-interactions-form', appContext).on('reset', function() {
				$('#aip-interactions-viewer-loci').attr('value','');
				$('#aip-interactions-viewer-cyto', appContext).addClass('hidden');
				$('#aip-interactions-viewer-legend', appContext).addClass('hidden');
				$('#aip-interactions-viewer-aiv', appContext).addClass('hidden');

				// Reset the loci
				loci = [];
			});

			// AIV link
			$('#aip-interactions-viewer-aiv', appContext).on('click', function() {
				var url = 'http://bar.utoronto.ca/interactions/cgi-bin/arabidopsis_interactions_viewer.cgi?qbar=yes&input=';	// BAR AIP URL to open

				// Now add all the valid loci. The AIV use textarea which is the input parameter. qbar is to query from BAR.
				for (var i = 0; i < loci.length; i++) {
					if (i === loci.length - 1) {
						url = url + loci[i];
					} else {
						url = url + loci[i] + '%0D%0A';
					}
				}

				// Published data set only
				if ($('#aip-interactions-viewer-pub', appContext).prop('checked')) {
					url = url + '&pdataonly=yes';
				}

				// Only include input loci in the network
				if ($('#aip-interactions-viewer-input-loci-only', appContext).prop('checked')) {
					url = url + '&filter=yes';
				}

				// Open the link in a new window
				window.open(url, '_blank');
			});

			// Submit button
			$('#aip-interactions-viewer-interactions-form', appContext).on('submit', function(e) {
				e.preventDefault();

				// Variables
				// Initialize variables
				nodes = [];	// Nodes of cytoscape graph
				edges = [];	// Edges of cytoscape graph
				loci = [];	// loci

				// Declare variables
				loci = $('#aip-interactions-viewer-loci', appContext).val().toUpperCase().split('\n');	// Get the data from textarea and convert it to an array
				var query = {};	// Query data for the BAR interactions webservice
				var elements = {};	// The final cytoscape data with nodes and edges
				var pubData, inputLociOnly, width, color, style;

				// Add query to nodes
				function addData(i) {
					// Get data from the BAR
					$.ajax({
						beforeSend: function(request) {
							request.setRequestHeader('Authorization', 'Bearer ' + Agave.token.accessToken);
						},
						type: 'GET',
						dataType: 'json',
						url: 'https://api.araport.org/community/v0.3/asher-live/interactions_v0.2/search?locus=' + loci[i] + '&published=' + pubData,
					}).done(function(response) {
						// Check for BAR web server errors

						// Check for error from AIV webservice
						if (response.status === 'failed') {
							window.alert('Error: ' + response.error + ' for Locus: ' + loci[i]);
							return;
						} else {
							// build Query nodes
							nodes.push({data: {
								id: loci[i],
								name: loci[i],
								nWidth: 40,
								nHeight: 40
							}});
						}

						// Parse the response and load the data
						for (var j = 0; j < response.result.length; j++) {
							// See if only user supplied AGI should be included
							if (inputLociOnly) {
								if ($.inArray(response.result[j].locus, loci) === -1) {
									continue;
								}
							}

							// Configure the width and style of the edges
							style = 'solid';
							if (response.result[j].interologConfidence > 10) {
								width = 6;
							} else if (response.result[j].interologConfidence > 5) {
								width = 4;
							} else if (response.result[j].interologConfidence > 2) {
								width = 2;
							} else {
								width = 1;
								style = 'dashed';
							}

							// set color. Published interactions have blue edges. All else have different shades.
							if (response.result[j].published === 'true') {
								color = '#6E8FBE';
								width = 6;
								style = 'solid';
							} else if (response.result[j].correlationCoefficient > 0.8) {
								color = '#AE0A11';
							} else if (response.result[j].correlationCoefficient > 0.7) {
								color = '#D53814';
							} else if (response.result[j].correlationCoefficient > 0.6) {
								color = '#EA811E';
							} else if (response.result[j].correlationCoefficient > 0.5) {
								color = '#F0BE14';
							} else {
								color = '#A2A3AB';
							}

							// Build interactor nodes
							nodes.push({data: {
								id: response.result[j].locus,
								name: response.result[j].locus,
								nWidth: 25,
								nHeight: 25
							}});

							// Build edges
							edges.push({data: {
								source: loci[i],
								target: response.result[j].locus,
								lineWidth: width,
								lineStyle: style,
								lineColor: color

							}});
						}
					});
				}

				// Workflow after hitting submit
				// See if the user wants published data or not
				if ($('#aip-interactions-viewer-pub', appContext).prop('checked')) {
					pubData = true;
				} else {
					pubData = false;
				}

				// See if only user supplied AGI should be included
				if ($('#aip-interactions-viewer-input-loci-only', appContext).prop('checked')) {
					inputLociOnly = true;
				} else {
					inputLociOnly = false;
				}

				// Validate Loci and return the validated list
				loci = validateLoci(loci);

				// Currently only support upto 20 AGI
				if (loci.length > 20) {
					window.alert('This app currently supports up to 20 AGIs.');
					return;
				}

				// Add data for each user supplied Locus
				for (i = 0; i < loci.length; i++) {
					addData(i);
				}

				// There are multiple AJAX call in this program, when they stop, this runs
				$(document).ajaxStop(function() {
					// If Ajax has stoped, load the Cytoscape graph
					elements = {nodes: nodes, edges: edges};
					loadCy(elements);
				});
			});

			// About button
			$('#aip-interactions-viewer-about').click(function() {
				window.alert('This app was developed by the BAR team with help from the Araport team. The data is obtained from BAR databases using webservices.');
			});
		});
	});
})(window, jQuery, cytoscape);
