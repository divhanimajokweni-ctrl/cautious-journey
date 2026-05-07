function computePosteriorMean(alpha, beta) {
    return alpha / (alpha + beta);
}
module.exports = { computePosteriorMean };