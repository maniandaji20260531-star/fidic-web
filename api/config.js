module.exports = (req, res) => res.status(200).json({ needCode: !!process.env.ACCESS_CODE });
