export class RequestError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "RequestError";
    }
}
