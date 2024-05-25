const State = Object.seal({
    websockets: {},
    ws: null,
    username: '',
    myUid: null,
    settings: {},
    users: {},
    posts: [],
    errors: [],
    streams: {},
    rpcs: {},
    buffer: [],
})

export { State }
