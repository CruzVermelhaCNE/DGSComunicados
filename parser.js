const cheerio = require('cheerio');
const request = require("request");
const nodemailer = require('nodemailer');
const fs = require('fs');

let recipients = [];

if (fs.existsSync('recipients.json')) {
    recipients = JSON.parse(fs.readFileSync('recipients.json'));
}

let email_settings = {};

if (fs.existsSync('email_settings.json')) {
    email_settings = JSON.parse(fs.readFileSync('email_settings.json'));
}

let transport = nodemailer.createTransport(email_settings);

let configs = {};

if (fs.existsSync('configs.json')) {
    configs = JSON.parse(fs.readFileSync('configs.json'));
}

let saved_comunicados = [];
if (fs.existsSync('comunicados.json')) {
    saved_comunicados = JSON.parse(fs.readFileSync('comunicados.json'));
}

function isNew(comunicado) {
    let found = false;
    saved_comunicados.forEach(element => {
        if (element.name == comunicado.name) {
            found = true;
        }
    });
    return !found;
}

function parseMyAwesomeHtml(html) {
    let new_comunicados = [];
    const $ = cheerio.load(html);
    const json = [];
    $(".register").each(function (i, elem) {
        let name = $(this).children('.register-title').text().trim();
        let pdf = 'https://www.dgs.pt/' + ($(this).children('.register-texts').children('.register-doc').children('a').attr('href'));
        let comunicado = {
            name: name,
            pdf: pdf
        };
        if (isNew(comunicado)) {
            new_comunicados.push(comunicado);
            saved_comunicados.push(comunicado);
        }
    });
    fs.writeFileSync('comunicados.json', JSON.stringify(saved_comunicados));
    new_comunicados.forEach(comunicado => {
        const message = {
            from: configs.from, // Sender address
            to: recipients, // List of recipients
            subject: "COMUNICADO DGS: " + comunicado.name, // Subject line
            replyTo: configs.replyTo,
            text: 'LINK: ' + comunicado.pdf // Plain text body
        };
        transport.sendMail(message, function (err, info) {
            if (err) {
                console.log(err)
            } else {
                console.log("Email sent");
            }
        });
        request.post(
            configs.discord_webhook,
            { json: { content: 'Novo Comunicado DGS. Nome: ' + comunicado.name + ". Link para o PDF: " + comunicado.pdf } },
            function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                }
            }
        );
    });
}

function loop() {
    request("https://www.dgs.pt/publicacoes/comunicados-e-despachos-do-diretor-geral.aspx", function (error, response, body) {
        if (!error) {
            parseMyAwesomeHtml(body);
        } else {
            console.log(error);
        }
    });
}

function main() {
    loop();
    setInterval(loop, 300000); //every 5 minutes
}

main();