# chunigram
A telegram bot that parse data from chunithm-net and calculate rating.
NOTE: This bot is only worked for internation version.

## Usage
Open your browser and console. (Press F12 to open the console)
Login chunithm-net-eng.com.
Open the `Network` tab in the console and find the request contains ssid like the screenshot below.
![Alt text](assets/ssid.png?raw=true "ssid")
Copy the string after `?ssid=`.

Go to the chunigram bot and send `/update` to the bot.
When the bot replies "Please enter your ssid.", send the ssid copied to the bot.
When you see "Updated successfully!", it means parsing data from chunithm-net is completed.
You may now use other query to check your rating and song info.
Enjoy~

## License
[MIT](https://choosealicense.com/licenses/mit/)