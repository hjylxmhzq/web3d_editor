
export function projectFromLonLat(lon: number, lat: number): [number, number] {

    // const x = lon * 20037508.34 / 180;
    // let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    // y = y * 20037508.34 / 180;
    return webMercatorProject(lon, lat);

}

const R = 6378137;
const MAX_LATITUDE = 85.0511287798;
export function webMercatorProject(lng: number, lat: number): [number, number] {
    var d = Math.PI / 180,
        max = MAX_LATITUDE,
        lat = Math.max(Math.min(max, lat), -max),
        sin = Math.sin(lat * d);

    return [
        R * lng * d,
        R * Math.log((1 + sin) / (1 - sin)) / 2,
    ];
}

const R_MINOR = 6356752.314245179;
// const bounds = [[-20037508.34279, -15496570.73972], [20037508.34279, 18764656.23138]];

export function mercatorProject(lng: number, lat: number): [number, number] {

    let d = Math.PI / 180,
        r = R,
        y = lat * d,
        tmp = R_MINOR / r,
        e = Math.sqrt(1 - tmp * tmp),
        con = e * Math.sin(y);

    let ts = Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);
    y = -r * Math.log(Math.max(ts, 1E-10));

    return [lng * d * r, y];

}