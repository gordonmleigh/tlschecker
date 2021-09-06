import { SNS } from "aws-sdk";
import { load } from "cheerio";
import fetchCookie from "fetch-cookie";
import nodeFetch from "node-fetch";

const cookieJar = new fetchCookie.toughCookie.CookieJar();
const fetch = fetchCookie(nodeFetch, cookieJar);
const sns = new SNS();

const LOGIN_URL = "https://de.tlscontact.com/gb/EDI/login.php";
const ALWAYS_NOTIFY = !!process.env.TLS_ALWAYS_NOTIFY;

let sessionUrl;

async function fetch$() {
  const response = await fetch.apply(this, arguments);
  if (!response.ok) {
    throw new Error(`unexpected status ${response.status}`);
  }
  return load(await response.text());
}

async function login({ email, password }) {
  console.log(`Fetching login...`);

  const loginParams = new URLSearchParams();
  const $ = await fetch$(LOGIN_URL);

  loginParams.set("_token", $("input[name=_token]").val());
  loginParams.set("email", email);
  loginParams.set("pwd", password);

  console.log(`Logging in...`);

  const response = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: loginParams.toString(),
  });
  if (!response.ok) {
    throw new Error(`unexpected status ${response.status}`);
  }

  const scriptTag = await response.text();
  const [, url] = /"([^"]+)"/.exec(scriptTag);
  return url;
}

async function checkAppointments(url) {
  console.log(`Fetch appointments...`);
  const $ = await fetch$(url);

  const full = $("div.take_appointment a.full").length;
  const available = $("div.take_appointment a:not(.full)").length;

  if (full + available === 0) {
    console.log(`Can't find any appointments, probably not authenticated...`);
    return;
  }

  console.log(`\nRESULTS: ${full} full appointments, ${available} free\n `);
  return { available, full };
}

async function runCheck(creds, notify) {
  try {
    let result;

    if (sessionUrl) {
      result = await checkAppointments(sessionUrl);
    }

    if (!result) {
      sessionUrl = await login(creds);
      result = await checkAppointments(sessionUrl);
    }

    if (!result) {
      throw new Error(`Unable to retrieve appointments`);
    }

    if ((result.available || ALWAYS_NOTIFY) && notify) {
      console.log(`Sending SMS to ${notify}`);

      await sns
        .publish({
          Message: `TLS: ${result.available} appointments are available!`,
          MessageStructure: "string",
          PhoneNumber: notify,
        })
        .promise();
    }
  } catch (err) {
    console.error(`ERROR:`, err);

    if (notify) {
      console.log(`Sending error SMS to ${notify}`);

      await sns
        .publish({
          Message: `TLS: an error occurred: ${err?.message}`,
          PhoneNumber: notify,
        })
        .promise();
    }
  }
}

async function handler() {
  const env = process.env;
  if (!env.TLS_USER || !env.TLS_PASS) {
    throw new Error(`must pass credentials in env USER and PASS`);
  }
  if (!env.TLS_PHONE_NUMBER) {
    console.warn(`No phone number provided (set TLS_PHONE_NUMBER)`);
  }
  await runCheck(
    { email: env.TLS_USER, password: env.TLS_PASS },
    env.TLS_PHONE_NUMBER
  );
}

exports.handler = handler;
exports.runCheck = runCheck;
