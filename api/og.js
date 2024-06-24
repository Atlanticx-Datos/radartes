const { ImageResponse } = require('@vercel/og');

module.exports = async function (req, res) {
  const { searchParams } = new URL(req.url, `https://${req.headers.host}`);
  const title = searchParams.get('title') || 'Default Title';
  const description = searchParams.get('description') || 'Default Description';

  return new ImageResponse(
    (
      <div
        style={{
          background: 'white',
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <h1 style={{ fontSize: 50 }}>{title}</h1>
        <p style={{ fontSize: 30 }}>{description}</p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
};
