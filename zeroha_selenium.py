import json
import re
import time
from collections import defaultdict

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class ZerodhaSelenium(object):

    def __init__(self, driver=None,info=None):
        self.timeout = 5
        self.loadCredentials()
        if not driver:
            chrome_options = Options()
            chrome_options = webdriver.ChromeOptions()
            # chrome_options.add_argument('headless')
            self.driver = webdriver.Chrome(r'C:\Users\Datac\Downloads\chromedriver.exe',chrome_options=chrome_options)
            self.driver.implicitly_wait(self.timeout)
            # self.driver.minimize_window()
            self.driver.maximize_window()
            # self.driver.set_window_size(1280, 720)
        else:
            self.driver = driver
        self.info = info

    def getCssElement(self, cssSelector):
        '''
        To make sure we wait till the element appears
        '''
        return WebDriverWait(self.driver, self.timeout).until(EC.presence_of_element_located((By.CSS_SELECTOR, cssSelector)))

    def loadCredentials(self):
        with open("credentials.json") as credsFile:
            data = json.load(credsFile)
            self.username = data['username']
            self.password = data['password']
            self.pin = data['pin']  # for 2FA

    def login(self):
        # let's login
        self.driver.get("https://kite.zerodha.com/")
        try:
            userNameField = self.getCssElement("input[placeholder='User ID']")
            userNameField.send_keys(self.username)
            passwordField = self.getCssElement("input[placeholder=Password]")
            passwordField.send_keys(self.password)
            loginButton = self.getCssElement("button[type=submit]")
            loginButton.click()

            # 2FA
            form2FA = self.getCssElement("form.twofa-form")
            pinField = form2FA.find_element_by_css_selector(
                "div:nth-child(2) > div > input[type=password]")
            pinField.send_keys(self.pin)
            buttonSubmit = self.getCssElement("button[type=submit]")
            buttonSubmit.click()

        except TimeoutException:
            print("Timeout occurred")

    def get_marketwatch(self):
        marketwatch_button_list = self.driver.find_element_by_class_name(
            'marketwatch-selector')
        for button in marketwatch_button_list.find_elements_by_class_name('item')[:-1]:
            button.click()
            time.sleep(0.5)
            instruments = self.driver.find_element_by_class_name(
                'instruments')
            matches = re.findall(r'(.+?)(?:\sEVENT)?\n(.+)\s\%\s(.+)\n?',
                                 instruments.text)
            for stock_name, price_changes, last_trading_price in matches:
                self.info[stock_name].update({
                    'stock_name': stock_name,
                    'price_changes': price_changes,
                    'last_trading_price': last_trading_price
                })

    def get_chart(self):
        # self.driver.get(url) # page fresh, slow
        # hover elemet: Elements ... right_click break on remove
        marketwatch_button_list = self.driver.find_element_by_class_name(
            'marketwatch-selector')
        for button in marketwatch_button_list.find_elements_by_class_name('item')[:-1]:
            button.click()
            instruments = self.driver.find_element_by_class_name('instruments')
            for instrument in instruments.find_elements_by_class_name('instrument'):
                self.driver.execute_script(
                    "arguments[0].scrollIntoView();", instrument)
                stock_name = instrument.find_element_by_class_name(
                    'symbol').text.replace(' EVENT','')
                instrument.click()
                instrument.find_elements_by_tag_name('button')[2].click()
                instrument.find_elements_by_tag_name('button')[3].click()
                instrument_market_data = self.driver.find_element_by_class_name(
                    'instrument-market-data')
                self.info[stock_name].update(
                    dict(re.findall(r'(\w+)\n(.+)\n', instrument_market_data.text)))

    def close(self):
        self.driver.quit()


if __name__ == "__main__":
    start = time.time()
    info = defaultdict(dict)
    zs = ZerodhaSelenium(info=info)
    zs.login()
    print(len(info))
    zs.get_marketwatch()
    print(len(info))
    zs.get_chart()
    print(len(info))
    print(time.time()-start)
    import ipdb;ipdb.set_trace()
    zs.close()

# 0
# 150
# 150
# 162.28338837623596
