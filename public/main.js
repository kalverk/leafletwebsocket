App = {

    ws: undefined,
    map: undefined,
    drawnItems: undefined,

    init: function () {
        this.initMap();
        this.initWebsocket();
    },

    initMap: function () {
        var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            osm = L.tileLayer(osmUrl, {maxZoom: 18, attribution: osmAttrib});
        this.map = new L.Map('map', {layers: [osm], center: new L.LatLng(58.78507, 25.72130), zoom: 7 });

        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);

        var drawControl = new L.Control.Draw({
            draw: {
                position: 'topleft',
                polygon: {
                    title: 'Draw a sexy polygon!',
                    allowIntersection: false,
                    drawError: {
                        color: '#b00b00',
                        timeout: 1000
                    },
                    shapeOptions: {
                        color: '#bada55'
                    },
                    showArea: true
                },
                polyline: {
                    metric: false
                },
                circle: {
                    shapeOptions: {
                        color: '#662d91'
                    }
                }
            },
            edit: {
                featureGroup: this.drawnItems
            }
        });
        this.map.addControl(drawControl);

        this.map.on('draw:created', function (e) {
            this.sendMessage(this.sendDrawing(e));
        }.bind(this));

        this.map.on('draw:edited', function (e) {
            e.layers.eachLayer(function (layer) {
                this.sendMessage(this.getDrawingData(layer.options.type, layer, {type:'draw:edited', data: {commonId: layer.options.commonId}}));
            }.bind(this));
        }.bind(this));

        this.map.on('draw:deleted', function (e) {
            e.layers.eachLayer(function (layer) {
                this.sendMessage({type:'draw:deleted', data: layer.options.commonId});
            }.bind(this));
        }.bind(this));
    },

    sendDrawing: function (e) {
        var type = e.layerType,
            layer = e.layer,
            result = this.getDrawingData(type, layer, {type:'draw:created', data: { type: type, color: this.color }});;
        return result;
    },

    getDrawingData: function (type, layer, result) {
        switch(type) {
            case 'circle':
                result.data.latlngs = this.getLatLngs([layer.getLatLng()]);
                result.data.radius = layer.getRadius();
                break;
            case 'marker':
                result.data.latlngs = this.getLatLngs([layer.getLatLng()]);
                break;
            default:
                result.data.latlngs = this.getLatLngs(layer.getLatLngs());
        };
        return result;
    },

    getLatLngs: function (latlngs) {
        var newLatlngs = [], i, len = latlngs.length;
        for (i = 0; i < len; i += 1) {
            newLatlngs.push([latlngs[i].lat,latlngs[i].lng]);
        }
        return newLatlngs;
    },

    addDrawing: function (drawing) {
        switch(drawing.type) {
            case 'polyline':
                this.createPolyline(drawing);
                break;
            case 'polygon':
                this.createPolygon(drawing);
                break;
            case 'rectangle':
                this.createRectangle(drawing);
                break;
            case 'circle':
                this.createCircle(drawing, drawing);
                break;
            case 'marker':
                this.createMarker(drawing);
                break;
        };
    },

    editDrawing: function (drawing) {
        this.drawnItems.eachLayer(function (layer) {
            if (drawing.commonId === layer.options.commonId) {
                layer.setLatLngs(drawing.latlngs);
            }
        }.bind(this));
    },

    deleteDrawing: function (commonId) {
        this.drawnItems.eachLayer(function (layer) {
            if (commonId === layer.options.commonId) {
                this.drawnItems.removeLayer(layer);
            }
        }.bind(this));
    },

    createPolyline: function (drawing) {
        var polyline = L.polyline(drawing.latlngs, {color: drawing.color});
        polyline.options.commonId = drawing.commonId;
        polyline.options.type = drawing.type;
        this.drawnItems.addLayer(polyline);
    },

    createPolygon: function (drawing) {
        var polygon = L.polygon(drawing.latlngs, {color: drawing.color});
        polygon.options.commonId = drawing.commonId;
        polygon.options.type = drawing.type;
        this.drawnItems.addLayer(polygon);
    },

    createRectangle: function (drawing) {
        var rectangle = L.rectangle(drawing.latlngs, {color: drawing.color});
        rectangle.options.commonId = drawing.commonId;
        rectangle.options.type = drawing.type;
        this.drawnItems.addLayer(rectangle);
    },

    createCircle: function (drawing) {
        var circle = L.circle(drawing.latlngs[0], drawing.radius, {color: drawing.color});
        circle.options.commonId = drawing.commonId;
        circle.options.type = drawing.type;
        this.drawnItems.addLayer(circle);
    },

    createMarker: function (drawing) {
        var marker = L.marker(drawing.latlngs[0], {color: drawing.color});
        marker.options.commonId = drawing.commonId;
        marker.options.type = drawing.type;
        this.drawnItems.addLayer(marker);
    },

    addHistory: function (data) {
        var i, len = data.length;
        for (i = 0; i < len; i += 1) {
            this.addDrawing(data[i]);
        }
    },

    initWebsocket: function () {
        var host = location.origin.replace(/^http/, 'ws');
        this.ws = new WebSocket(host);
        this.ws.onmessage = function (event) {
            this.parseBroadcast(event);
        }.bind(this);
    },

    parseBroadcast: function (event) {
        var eventData = JSON.parse(event.data);
        switch(eventData.type) {
            case 'conf':
                this.id = eventData.data.id;
                this.color = eventData.data.color;
                break;
            case 'history':
                this.addHistory(eventData.data);
                break;
            case 'draw:created':
                this.addDrawing(eventData.data);
                break;
            case 'draw:deleted':
                this.deleteDrawing(eventData.data);
                break;
            case 'draw:edited':
                this.editDrawing(eventData.data);
                break;
        };
        var li = document.createElement('li');
        li.innerHTML = eventData.type;
        document.querySelector('#pings').appendChild(li);
    },

    sendMessage: function (data) {
        if(this.ws.readyState === this.ws.OPEN){
            this.ws.send(JSON.stringify(data));
        }else{
            console.log('ws closed');
        }
    }

}

App.init();