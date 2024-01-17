import puppeteer from "puppeteer";
import fs from "fs";

const urls = [
  //'https://www.ubereats.com/za/store/woolworths-foodstop-edenburg/J7RJGeJ9STSYJYNjWfVIzA?diningMode=PICKUP&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMjM2JTIwRmFybWVyJ3MlMjBGb2xseSUyMFN0JTIyJTJDJTIycmVmZXJlbmNlJTIyJTNBJTIyQ2hJSmQ4dFRXNjFobFI0Ukp5N09fR1lTTW8wJTIyJTJDJTIycmVmZXJlbmNlVHlwZSUyMiUzQSUyMmdvb2dsZV9wbGFjZXMlMjIlMkMlMjJsYXRpdHVkZSUyMiUzQS0yNS43NTQ2NTc1JTJDJTIybG9uZ2l0dWRlJTIyJTNBMjguMjUxNjM0NCU3RA%3D%3D',
  //'https://www.ubereats.com/za/store/woolworths-foodstop-bryanston/3_H8sVnGSc-4vqSDAVbDdg?diningMode=PICKUP',
  //'https://www.ubereats.com/za/store/woolworths-food-stop-rivonia/naE_J7aVTYiWAllzeYVi3w?diningMode=PICKUP'
  'https://www.ubereats.com/za/store/woolworths-foodstop-ballito/0ofCFNcfWIGUU8n7NrgaBw?diningMode=DELIVERY'
]


const wait = async (time) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

const load = async (url) => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });
  const pageItems = [];
  const page = await browser.newPage();

  page.setDefaultTimeout(1000);
  page.setDefaultNavigationTimeout(10000);

  await page.goto(url, {
    waitUntil: "domcontentloaded"
  });

  // check if a specific div has been loaded with a specific data attribute
  try {
    let lock = await page.waitForSelector('div[data-focus-lock-disabled="false"]');
    console.log('here after lock', lock);

    // if lock exists, then find button with aria-label="Close" and click it
    if (lock) {
      let close = await page.waitForSelector('button[aria-label="Close"]');
      await close.click();
    }
  } catch (e) {
    console.log('no lock');
  }

  // check to see if we can pull the list of buttons from the left navigation bar. The parent element type has nav and the role="navigation".
  let nav = await page.waitForSelector('nav[role="navigation"]');

  // nav children are divs, which have a button child, which has a div child. Get the inner child
  let navElements = Array.from(Object.values(await nav.$$('div > button > div')));

  const processNavElments = async () => {
    console.log(typeof navElements, navElements.length);
    if (navElements.length === 0) {
      return;
    }
    let navElement = navElements.shift();

    try {
      await navElement.click();
      await wait(1000);

      const getItemsFromPage = async () => {
        try {
          // get all the divs which are child items of div[data-testid^="store-menu-item"]
          let storeMenuItems = await page.$$('div[data-testid^="store-menu-item"]');

          for (const menuItems of storeMenuItems) {
            let spans = await menuItems.$$('span[data-testid="rich-text"]');

            let skip = false;
            let item = {
              price: '',
              description: '',
            };

            try {
              item.price = await spans[0].evaluate(el => el.textContent);
              item.description = await spans[1].evaluate(el => el.textContent);
              pageItems.push(item);
            } catch (e) {
              console.log('no spans');
            }
          }

        } catch (e) {
          console.log('no spans');
        }
      }

      // get all the items on the page,then scroll down and get more items, repeat this until you cannot scroll down any more
      let previousHeight;
      while (true) {
        await getItemsFromPage();
        try {
          page.setDefaultTimeout(1000);
          previousHeight = await page.evaluate('document.body.scrollHeight');
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
        } catch (e) {
          await getItemsFromPage();
          console.log('no more items');
          break;
        }
      }

      // wait 2 seconds before loading the next menu item
      await wait(2000);
      await processNavElments();
    } catch (e) {
      console.log('no divs');
    }
  };

  await processNavElments();

  let store = url.split('store/')[1].split('/')[0];
  let stream = fs.createWriteStream(store + ".txt");
  console.log('pageItems', pageItems);
  pageItems.forEach(async pageItem => {
    stream.write(`${pageItem.price}; ${pageItem.description} \n`);
  });

}

const processUrls = async () => {
  if (urls.length === 0) {
    return;
  }
  let url = urls.shift();
  console.log('processing', url);

  await load(url);

  // wait 2 seconds before loading the next url
  await wait(2000);
  processUrls();
}

processUrls();
