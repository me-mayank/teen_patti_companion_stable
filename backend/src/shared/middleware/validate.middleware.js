const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!result.success) return res.status(400).json({ message: result.error.issues.map(issue => issue.message).join(', ') });
  if (result.data.body) req.body = result.data.body;
  next();
};
module.exports = { validate };
