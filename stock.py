# -*- coding: utf-8 -*-
import json
import os
import subprocess
import time
from collections import defaultdict

import pandas as pd
import requests
import xlwings as xw
from bs4 import BeautifulSoup
from tqdm import tqdm
import numpy as np
from statistics import mean 
import numba
from zeroha_selenium import ZerodhaSelenium



headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36'
}


def login(session, user_id, password, pin):
    data = {'user_id': user_id, 'password': password}
    res = session.post('https://kite.zerodha.com/api/login',
                       headers=headers, data=data)
    request_id = res.json()['data']['request_id']

    data = {'user_id': user_id,
            'request_id': request_id,
            'twofa_value': pin}
    res = session.post('https://kite.zerodha.com/api/twofa',
                       headers=headers, data=data)

def get_indicators(session, headers,
                  instrument_token='633601',
                  time_str='5minute',
                  period=13):
    indicators = {}
    ciqrandom = str(time.time()).replace('.', '')[:-4]
    enctoken = session.cookies.get('enctoken')
    user_id = session.cookies.get('user_id')
    tmp_headers = dict(headers)
    tmp_headers.update({
        'authorization': 'enctoken %s' % (enctoken)
    })
    his_url = 'https://kite.zerodha.com/oms/instruments/historical/'
    #timedelta = (period//3)*24*60*60
    timedelta = 20*24*60*60    # 20 days
    from_date = time.strftime(
        '%Y-%m-%d', time.localtime(time.time()-timedelta))
    to_date = time.strftime('%Y-%m-%d', time.localtime())
    res = s.get(
        his_url+f'{instrument_token}/{time_str}?user_id={user_id}&oi=1&from={from_date}&to={to_date}&ciqrandom={ciqrandom}', headers=tmp_headers)
    records = []
    for x in res.json()['data']['candles']:
        records.append({
            'time': x[0],
            'open': x[1],
            'high': x[2],
            'low': x[3],
            'close': x[4],
            'volume': x[5],
            'xxx': x[6]
        })
    df = pd.DataFrame.from_records(records[-period:])
    
    high = df.high.to_list()
    low = df.low.to_list()
    close = df.close.to_list()
    TPs = [(high[i]+low[i]+close[i])/3 for i in range(len(high))]
    #print(TPs)
    
    indicators['william'] = round(-(df.high.max()-df.close.to_list()[-1])/(df.high.max()-df.low.min())*100, 2)
    emas = df.close.ewm(span=5, adjust=False).mean()
    indicators['ema'] = emas.iloc[-1]
    #print(indicators, "INDICS")
    smas = df.close.rolling(window=10).mean()
    stdev = df.close.rolling(window=10).std()
    stdevm = stdev.iloc[-1]
    smam = smas.iloc[-1]
    indicators['sma']= smas.iloc[-1]
    indicators['bollinger'] = (smam + stdevm * 1.9, smam, smam - stdevm * 1.9)
    one_two_period = 3
    df_one_two = pd.DataFrame.from_records(records[-one_two_period:]) 
    one_two_open = df_one_two.open.to_list()
    one_two_close = df_one_two.close.to_list()
    one_two_high = df_one_two.high.to_list()
    one_two_low = df_one_two.low.to_list()
   
    indicators['open1'] = one_two_open[0]
    indicators['open2'] = one_two_open[1]
    indicators['open3'] = one_two_open[2]
    indicators['close1'] = one_two_close[0]
    indicators['close2'] = one_two_close[1]
    indicators['close3'] = one_two_close[2]
    indicators['high1'] = one_two_high[0]
    indicators['high2'] = one_two_high[1]
    indicators['high3'] = one_two_high[2]
    indicators['low1'] = one_two_low[0]
    indicators['low2'] = one_two_low[1]
    indicators['low3'] = one_two_low[2]

    df = pd.DataFrame.from_records(records[-50:])
    HH = df.high.rolling(window=6).max()
    LL = df.low.rolling(window=6).min()
    M = (HH+LL)/2
    D = df.close - M
    HL = HH-LL

    multiplier = np.array(
        [1/(2**19),1/(2**19),1/(2**18),1/(2**17),1/(2**16)
         ,1/(2**15),1/(2**14),1/(2**13),1/(2**12),1/(2**11)
         ,1/(2**10),1/(2**9),1/(2**8),1/(2**7),1/(2**6)
         ,1/(2**5),1/(2**4),1/(2**3),1/(2**2),1/(2**1)
            ])
    #D_MA_1 = D.rolling(window=3).mean()
    #D_MA = D_MA_1.rolling(window=3).mean()
    D_MA = D.rolling(window=20).apply(lambda x: sum(x * multiplier))
    #HL_MA_1 = HL.rolling(window=3).mean()
    #HL_MA = HL_MA_1.rolling(window=3).mean()
    HL_MA = HL.rolling(window=20).apply(lambda x: sum(x * multiplier))
    #D_SMOOTH_1 = D_MA.rolling(window=3).mean()
    #D_SMOOTH = D_SMOOTH_1.rolling(window=3).mean()
    D_SMOOTH = D_MA.rolling(window=20).apply(lambda x: sum(x * multiplier))
    #HL_SMOOTH_1 = HL_MA.rolling(window=3).mean()
    #HL_SMOOTH = HL_SMOOTH_1.rolling(window=3).mean()
    HL_SMOOTH = HL_MA.rolling(window=20).apply(lambda x: sum(x * multiplier))
    HL2 = HL_SMOOTH / 2
    SMI = 100 * D_SMOOTH[49] / HL2[49]
    SMI_1 = 100 * D_SMOOTH[48] / HL2[48]
    SMI_2 = 100 * D_SMOOTH[47] / HL2[47]
    SMI_3 = 100 * D_SMOOTH[46] / HL2[46]
    SMI_4 = 100 * D_SMOOTH[45] / HL2[45]
    SMI_SIGNAL = (SMI + SMI_1 * 2 + SMI_2) / 4
    
    indicators['smi'] = SMI
    indicators['smi_signal'] = SMI_SIGNAL
  
    return indicators

def dump_marketwatch(session, headers):
    public_token = session.cookies.get('public_token')
    tmp_headers = dict(headers)
    tmp_headers.update({
        'x-csrftoken': public_token
    })
    res = s.get('https://kite.zerodha.com/api/marketwatch',
                headers=tmp_headers)
    marketwatch = []
    for x in res.json()['data']:
        marketwatch.extend(x['items'])
    df = pd.DataFrame.from_records(marketwatch)
    df.to_csv('marketwatch.csv', encoding='utf-8', index=False)
    df = df[df['segment'].isin(['NSE'])]
    df = df.drop_duplicates(['instrument_token'])
    df[['tradingsymbol', 'instrument_token']].to_csv(
        'marketwatch.min.csv', index=False)


def update_stock(session, marketwatch, sheet):
    #print(len(info))
    #zerodha_selenium.get_marketwatch()
    #print(len(info))
    #zerodha_selenium.get_chart()
    #zs.close()
    
    call_node_js()
    info = defaultdict(dict)
    for x in tqdm(marketwatch.iterrows()):
        tradingsymbol, instrument_token = x[1].tradingsymbol, x[1].instrument_token
        # url = f'https://kite.zerodha.com/chart/web/ciq/{segment}/{tradingsymbol}/{instrument_token}'
        # bollinger upperband, moving average, lowerband
        indicators = get_indicators(session, headers,
                                        instrument_token=instrument_token,
                                        time_str='5minute',
                                        period=13)
        
        william15 = indicators['william']
        ema15 = indicators['ema']
        sma15 = indicators['sma']
        bolu15, bolm15, bold15 = indicators['bollinger']
        open1 = indicators['open1']
        open2 = indicators['open2']
        open3 = indicators['open3']
        close1 = indicators['close1']
        close2 = indicators['close2']
        close3 = indicators['close3']
        high1 = indicators['high1']
        high2 = indicators['high2']
        high3 = indicators['high3']
        low1 = indicators['low1']
        low2 = indicators['low2']
        low3 = indicators['low3']
        SMI = indicators['smi']
        SMIsignal = indicators['smi_signal']

        info[instrument_token].update({
            'stock_name': tradingsymbol,
            'instrument_token': instrument_token,
            '10m_william_R_13': william15,
            '10EMA': ema15,
            '10SMA': sma15,
            '10BOLU15': bolu15,
            '10BOLM15': bolm15,
            '10BOLD15': bold15,
            '1 3 open': open1,
            '1 3 high': high1,
            '1 3 low': low1,
            '1 3 close': close1,
            '2 3 open': open2,
            '2 3 high': high2,
            '2 3 low': low2,
            '2 3 close': close2,
            '3 3 open': open3,
            '3 3 high': high3,
            '3 3 low': low3,
            '3 3 close': close3,
            'SMI':SMI,
            'SMIsignal':SMIsignal
                        
        })
        
    quote = json.load(open('quote.txt', 'r', encoding='utf-8'))
    
    for x in quote:
        x.update(info[x['token']])
    stock_df = pd.DataFrame.from_records(quote)
    sheet.range('A1').value = stock_df

# # https://kite.zerodha.com/static/js/main-chartiq.557fc800.js
# translate2python 不具备通用性

def call_node_js():
    subprocess.call(['node','zeroha_ws.js'])
   
if __name__ == '__main__':
    s = requests.Session()
    with open("credentials.json") as credsFile:
        data = json.load(credsFile)
        username = data['username']
        password = data['password']
        pin = data['pin']
    login(s, username, password, pin)

    if True or os.path.exists('marketwatch.csv'):
        dump_marketwatch(s, headers)
    marketwatch = pd.read_csv('marketwatch.min.csv')

    wb = xw.Book('stock10.xlsx')
    sht = wb.sheets['Sheet1']

    # info = defaultdict(dict)
    # zs = ZerodhaSelenium(info=info)
    # zs.login()

    iteration = 1
    # Press CTRL-C to stop updating!
    while (True):
        try:
            print('*'*60)
            print(iteration, "Starting...")

            start = time.time()
            update_stock(s, marketwatch, sht)
            waiting_time = 120 - (time.time()-start)  # in sec
            if waiting_time > 0:
                print('Waiting for '+str(waiting_time)+' sec.')
                time.sleep(waiting_time)

        except Exception as e:
            print(e)
            break
        iteration += 1
