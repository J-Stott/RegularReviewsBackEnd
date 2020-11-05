class HttpError extends Error {
    constructor(message, errorCode) {
        super(message);
        this.code = errorCode;
    }
}

const sendHttpError = (message, code, next) => {
    const error = new HttpError(message, code);
    return next(error);
}

module.exports = {
    HttpError: HttpError,
    sendHttpError: sendHttpError
};