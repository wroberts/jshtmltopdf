# jshtmltopdf: AngularJS HTML -> PDF

[![Greenkeeper badge](https://badges.greenkeeper.io/wroberts/jshtmltopdf.svg)](https://greenkeeper.io/)

This project converts dynamic HTML (such as a site using the
AngularJS framework) to PDF.  It does this in two steps:

1. Use puppeteer to fetch the page and generate the HTML; save this
   out to disk.
2. Use wkhtmltopdf to convert the static HTML to PDF.

## Build
 
```
docker build -t jshtmltopdf .
```

## Demo

```
docker run -it --rm -v `pwd`:/app jshtmltopdf http://www.google.com render.pdf
```
