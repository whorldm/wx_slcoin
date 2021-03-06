var Utils = require('../../utils/util.js');
const app = getApp();
var coinTimer;  //获取币种信息的定时器
var waitTime; // 等待比赛开始的定时器
var timer;  //比赛倒计时的定时器
var total_second = 8 * 60 * 60 * 1000; // 2h的倒计时
var test = '333333'

Page({
  /**
   * 页面的初始数据
   */
  data: {
    user_id: '',
    room_num: '',
    currentSlide: 0, // 新手教程显示的当前页
    isWatchNew: false, //是否显示新手教程
    step: 1, // 表示进行的步骤：1-未参赛，2-邀请好友，3-开赛进行交易，4-比赛结束
    isEnterGame: false, // 是否参加比赛
    isStartGame: false, // 是否开赛
    unFullNum: 1, // 当前房间人数
    countURL: '',  // 开赛前倒计时的数字图标 
    clockURL: '../../image/countdown/1.png', // 条形倒计时的图片
    clock: "00:00:00",  // 开赛后的倒计时

    coinList: [], // 当前所有币种信息数组
    coinType: '', // 买入时选择的币种
    coinMoney: '', // 买入时选择币种的价格
    coinIndex: 0,  // 买入时选择的币种（coinList数组中所在的序号）

    ownCoinList: [], // 自己所持币种的所有信息
    ownCoinType: '--', // 卖出时选择的币种
    ownCoinMoney: '--', // 卖出时选择币种的价格
    ownCoinIndex: 0,  // 卖出时选择的币种（ownCoinList数组中所在的序号）

    AvailableMoney: '', // 当前可用余额
    currentTab: 0, // 当前所在的tab：0-买入，1-卖出，2-交易记录 
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    msgList:['目前暂无交易记录'],
    recordList:[],
    our: {
      assets: '20000',  // 目前的资产
      possess: [], //目前持有的币种
      income: '',
      yield: ''
    },
    myrank: 1,
    query: {}  //保存分享而来的参数信息
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 如果是从分享中进入，获取分享人的ID和房间号
    if(options.user_id) {
      this.setData({
        query: {
          from: options.user_id,
          room_num: options.room_num
        }
      })
    }
    // 判断用户是否是初次参加比赛
    if (!wx.getStorageSync('isAuthorize')) {
      this.setData({
        isWatchNew: true
      })
    }
    // 如果用户退出后再次进入小程序，获取缓存的user_id和room_num
    wx.getStorage({
      key: 'room_num',
      success: res => {
        this.setData({
          room_num: res.data
        })
      }
    })
    wx.getStorage({
      key: 'user_id',
      success: res => {
        this.setData({
          user_id: res.data
        })
      }
    })
  },

  /**
   * 当页面显示的时候
   */
  onShow: function(){
    wx.getStorage({
      key: 'step',
      success: res => {
        this.setData({
          step: res.data
        })
        this.JugeTheStatus(res.data);
      }
    })
  },

  /**
   * 当页面隐藏的时候
   */
  onHide: function () {
    clearTimeout(coinTimer);
  },

  // 关闭新手教程
  toJumpTheNew: function(){
    this.setData({
      isWatchNew: false
    })
  },

  // 切换到下一页的教程
  toNextNew: function() {
    this.setData({
      currentSlide: 1
    })
  },

  // 判断用户的状态，并初始化数据
  JugeTheStatus: function (step) {
    console.log('状态更改，初始化数据。。。。')
    if (step === 2) {
      console.log('状态2')
      this.getRoomInfo();
    }

    if (step === 3) {
      console.log('状态3')
      if(waitTime){
        clearTimeout(waitTime);
      }
      
      if (this.data.currentTab === 0) {
        this.Buy = this.selectComponent("#buy");
        this.Buy.init();
      } else if (this.data.currentTab === 1) {
        this.Sale = this.selectComponent("#sale");
        this.Sale.init();
      }

      this.getCoinInfo();
      this.getRollingInfor();
      this.getMyAssets();

      wx.getStorage({
        key: 'endTime',
        success: (res) => {
          console.log(res)
          total_second = Utils.completeTime(res.data);
          CountOneDay(this);
        },
      })
    }

    if(step === 4) {
      console.log('状态4');
      if(coinTimer) {
        clearTimeout(coinTimer);
      }
      this.getLastReward();
    } 
  },

  // 点击立即参赛，获取用户信息权限
  getUserInfo: function (e) {
    if (e.detail.userInfo) { // 用户点击了授权,并将用户的信息缓存
      wx.setStorage({
        key: "isAuthorize",
        data: true
      })
      wx.setStorage({
        key: "userInfo",
        data: e.detail.userInfo
      })
      wx.showToast({
        title: '授权成功',
      });
    } else {  // 用户拒绝了授权
      wx.showModal({
        title: '警告',
        content: '您点击了拒绝授权，可能没办法更好的体验炒币大咖!',
        showCancel: false
      })
    }
    let userData = {
      nickname: encodeURIComponent(e.detail.userInfo.nickName || ''),
      wei_pic: encodeURIComponent(e.detail.userInfo.avatarUrl || '../../image/login.png'),
      time: Utils.formatTime(new Date())
    };

    this.userLogin(userData);
  },

  // 用户登录，并获取user_id
  userLogin: function (userData) {
    wx.showLoading({
      title: '正在分配房间中...',
    })
    wx.login({
      success: res => {
        if (res.code) {
          app.globalData.code = res.code;
          console.log('获取Code');

          let params = userData;
          params.code = res.code;
          params.time = Utils.formatTime(new Date());

          wx.request({
            url: app.globalData.ROOTURL + '/authorization',
            data: params,
            success: res => {
              console.log('获取user_id');
              if (res.statusCode === 200) {
                app.globalData.user_id = res.data.user_id;
                this.setData({
                  user_id: res.data.user_id
                })
                console.log('user_id:', res.data.user_id);
                wx.setStorage({
                  key: 'user_id',
                  data: res.data.user_id
                })
                console.log('缓存user_id！');

                this.joinGame(res.data.user_id);
              }
            },
            fail: err => {
              wx.showToast({
                title: '获取user_id失败',
                icon: 'none'
              });
            }
          })
        } else {
          wx.showToast({
            title: '微信登录失败',
            icon: 'none'
          });
        }
      }
    })
  },
  
  // 立即参赛
  joinGame: function (temp) {
    console.log('立即参赛')
    let params = {
      user_id: temp,
      time: Utils.formatTime(new Date())
    }
    if (this.data.query.from) {
      params.from = this.data.query.from;
      params.room_num = this.data.query.room_num;
    }
    console.log('参赛传递的参数')
    console.log(params)
    wx.request({
      url: app.globalData.ROOTURL + '/game/join',
      data: params,
      success: res => {
        console.log('参赛后返回的数据')
        console.log(res)
        if (res.statusCode === 200) {
          wx.hideLoading(); //关闭分配房间的提示

          console.log('参赛成功获取房间号')
          let currenStep = 2;
          app.globalData.room_num = res.data.roomNum || res.data.room_num;

          if (res.data.isStartGame && res.data.end_time) { //  异地登陆后，该用户以及参见过比赛，且该比赛尚未结束
            currenStep = 3;
            wx.setStorage({
              key: "isStartGame",
              data: true
            })
            wx.setStorage({
              key: "endTime",
              data: Utils.ToDate(res.data.end_time)
            })
          }
          this.setData({
            step: currenStep,
            room_num: res.data.roomNum || res.data.room_num,
            isEnterGame: true,
            isStartGame: currenStep === 3,
            unFullNum: res.data.number
          })
          wx.setStorage({
            key: "step",
            data: currenStep
          })
          wx.setStorage({
            key: "room_num",
            data: res.data.roomNum || res.data.room_num
          })
          wx.setStorage({
            key: "isEnterGame",
            data: true
          })
          this.JugeTheStatus(currenStep);  //登录后变更状态，需要重新初始化数据

        } else {
          wx.showToast({
            title: '参赛失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error(err);
      }
    })
  },

  // 在等待开赛时，轮询获取房间的信息
  getRoomInfo: function () {
    console.log('开始获取房间信息')
    let temp_user = app.globalData.user_id;
    let temp_room = app.globalData.room_num;
    if (temp_room === ''){
      if (this.data.room_num !== '' && this.data.room_num !== undefined){
        temp_room = this.data.room_num;
      } else {
        wx.getStorage({
          key: 'room_num',
          success: res => {
            temp_room = res.data;
          },
        })
      }
    }
    if (temp_user === '') {
      if (this.data.user_id !== '' && this.data.user_id !== undefined) {
        temp_user = this.data.user_id;
      } else {
        wx.getStorage({
          key: 'user_id',
          success: res => {
            temp_user = res.data;
          },
        })
      }
    }

    clearTimeout(waitTime);

    wx.request({
      url: app.globalData.ROOTURL + '/room_info',
      data: {
        user_id: temp_user,
        room_num: temp_room,
        time: Utils.formatTime(new Date())
      },
      success: res => {
        console.log(res)
        if (res.statusCode === 200) {
          console.log('成功更新房间信息')
          this.setData({
            unFullNum: res.data.number
          })

          if(res.data.number >= 30 && res.data.endTime) {
            console.log('获取比赛结束时间', res.data.endTime)
            let temp_time;
            if(res.data.endTime === null || res.data.endTime === '' || res.data.endTime === undefined){
              temp_time = new Date(new Date().getTime() + 2 * 60 * 60 * 1000)
            } else {
              temp_time = Utils.ToDate(res.data.endTime);
            }

            wx.setStorage({
              key: 'endTime',
              data: temp_time,
            })
            clearTimeout(waitTime);
            this.StartGame(temp_time);
          }
        } else {
          wx.showToast({
            title: '获取房间信息失败',
            icon: 'none'
          })
        }
        
        waitTime = setTimeout(() => {
          this.getRoomInfo();
        }, 1000);
      },
      fail: err => {
        console.error('获取房间信息失败！');
      }
    })
  },

  // 请求虚拟货币的基本信息
  getCoinInfo: function() {
    console.log('获取币种信息')
    let temp = app.globalData.user_id;
    if (temp === '') {
      if (this.data.user_id !== '' && this.data.user_id !== undefined) {
        temp = this.data.user_id;
      } else {
        wx.getStorage({
          key: 'user_id',
          success: res => {
            temp = res.data
          }
        });
      }
    }

    clearTimeout(coinTimer);

    wx.request({
      url: app.globalData.ROOTURL + '/coin_info',
      data: {
        user_id: temp,
        time: Utils.formatTime(new Date())
      },
      success: res => {
        console.log(res)
        if (res.statusCode === 200) {
          console.log('获取币种信息成功')
          this.setData({
            coinList: res.data,
            coinType: res.data[this.data.coinIndex].coin_type,
            coinMoney: res.data[this.data.coinIndex].coin_money,
            ownCoinType: this.data.ownCoinList.length > 0 ? this.data.ownCoinList[this.data.ownCoinIndex].coin_type : '--',
            ownCoinMoney: this.data.ownCoinList.length > 0 ? this.data.ownCoinList[this.data.ownCoinIndex].coin_money : '--'
          })

          coinTimer = setTimeout(() => {
            this.getCoinInfo();
          }, 20 * 1000);

        } else {
          wx.showToast({
            title: '获取币种信息失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error('获取币种信息失败！');
      }
    })

  },

  // 获取比赛时的用户交易信息
  getRollingInfor: function () {
    console.log('获取比赛用户的交易信息')
    let temp = app.globalData.user_id;
    if (temp === '') {
      if (this.data.user_id !== '' && this.data.user_id !== undefined) {
        temp = this.data.user_id;
      } else {
        wx.getStorage({
          key: 'user_id',
          success: res => {
            temp = res.data
          }
        });
      }
    }

    wx.request({
      url: app.globalData.ROOTURL + '/rolling',
      data: {
        user_id: temp,
        time: Utils.formatTime(new Date())
      },
      success: res => {
        console.log(res)
        if (res.statusCode === 200) {
          console.log('获取交易信息成功')
          if(res.data.length > 0) {
            this.setData({
              msgList: res.data
            });
          }
        } else {
          wx.showToast({
            title: '获取交易信息失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error('获取交易信息失败！');
      }
    })
  },

  //请求当前用户的个人资产
  getMyAssets: function () {
    console.log('获取当前用户的个人资产信息')
    let temp = app.globalData.user_id;
    if (temp === '') {
      if (this.data.user_id !== '' && this.data.user_id !== undefined) {
        temp = this.data.user_id;
      } else {
        wx.getStorage({
          key: 'user_id',
          success: res => {
            temp = res.data
          }
        });
      }
    }

    wx.request({
      url: app.globalData.ROOTURL + '/personAsset',
      data: {
        user_id: temp,
        time: Utils.formatTime(new Date())
      },
      success: res => {
        console.log(res)
        if (res.statusCode === 200) {
          console.log('获取个人资产信息成功')
          this.setData({
            our: {
              assets: res.data.money,
              possess: Utils.DealMyOwn(res.data.possess)
            }
          })
        } else {
          wx.showToast({
            title: '获取个人资产信息失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error('请求当前用户的个人资产失败！');
      }
    })
  },

  // 用户点击右上角分享
  onShareAppMessage: function (res) {
    let temp_user = app.globalData.user_id;
    let temp_room = app.globalData.room_num;
    if (temp_room === '') {
      if (this.data.room_num !== '' && this.data.room_num !== undefined) {
        temp_room = this.data.room_num;
      } else {
        wx.getStorage({
          key: 'room_num',
          success: res => {
            temp_room = res.data;
          },
        })
      }
    }
    if (temp_user === '') {
      if (this.data.user_id !== '' && this.data.user_id !== undefined) {
        temp_user = this.data.user_id;
      } else {
        wx.getStorage({
          key: 'user_id',
          success: res => {
            temp_user = res.data;
          },
        })
      }
    }
    return {
      title: '炒币大咖',
      path: '/pages/trade/trade?room_num=' + temp_room + '&user_id=' + temp_user,
    }
  },

  // 开始比赛(目前是点击金币图片，实现开赛)
  StartGame: function (endTime){
    this.setData({
      isStartGame:true,
      endTime: endTime
    });
    wx.setStorage({
      key: 'isStartGame',
      data: true,
    })
    count_down(this);
  },

  // 买入时选择币种事件 
  bindPickerChange: function(e) {
    let item = this.data.coinList[e.detail.value];
    this.setData({
      coinIndex: Number(e.detail.value),
      coinType: item.coin_type,
      coinMoney: item.coin_money,
    })

    if(this.data.currentTab === 0) {
      this.Buy = this.selectComponent('#buy');
      this.Buy.init();
    }
  },

  // 个人所持有币的下拉选择框
  ownCoinPickerChange: function (e){
    let item = this.data.ownCoinList[e.detail.value];
    this.setData({
      ownCoinIndex: Number(e.detail.value),
      ownCoinType: item.coin_type,
      ownCoinMoney: item.coin_money,
    })

    if (this.data.currentTab === 1) {
      this.Sale = this.selectComponent("#sale");
      this.Sale.init();
    }
  },

  // 初始化个人目前所持有的币
  initOwnCoinList: function () {
    let tempList = [];
    if (JSON.stringify(this.data.our.possess) !== "{}") {
      for (let key in this.data.our.possess) {
        for (let i = 0, len = this.data.coinList.length; i < len; i++) {
          if (this.data.coinList[i].coin_type === key) {
            tempList.push(this.data.coinList[i]);
          }
        }
      }
    }
    
    this.setData({
      ownCoinIndex: 0,
      ownCoinList: tempList,
      ownCoinType: tempList.length > 0 ? tempList[0].coin_type : '--',
      ownCoinMoney: tempList.length > 0 ? tempList[0].coin_money : '--'
    });
  },

  // 选择买入/卖出/交易记录的Tab
  switchTab: function (e) {
    let tab = e.currentTarget.id;
    switch(tab) {
      case 'tabbuy':
        this.setData({ currentTab: 0 });
        this.Buy = this.selectComponent('#buy');
        this.Buy.init();
        break;
      case 'tabsale':
        this.setData({ currentTab: 1 });
        this.initOwnCoinList(); // 选择了卖出，初始化用户目前的持有币种
        this.Sale = this.selectComponent("#sale");
        this.Sale.init();
        break;
      case 'tabrecord':
        this.setData({ currentTab: 2 });
        this.getUserRecords();
        break;
    }
  },

  // 查看本人的当场比赛的交易记录
  getUserRecords: function (){
    console.log('获取交易记录')
    let temp = app.globalData.user_id;
    if (temp === '') {
      if (this.data.user_id !== '' && this.data.user_id !== undefined) {
        temp = this.data.user_id;
      } else {
        wx.getStorage({
          key: 'user_id',
          success: res => {
            temp = res.data
          }
        });
      }
    }

    wx.request({
      url: app.globalData.ROOTURL + '/transationRecord',
      data: {
        user_id: temp,
        time: Utils.formatTime(new Date())
      },
      success: res => {
        console.log(res);
        if (res.statusCode === 200) {
          console.log('获取个人交易记录成功')
          this.setData({
            recordList: res.data
          })
        } else {
          wx.showToast({
            title: '获取个人交易记录失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error('获取个人交易记录失败！');
      }
    })
  },

  // 买入卖出成功后，更新个人资产
  ChangeMyAssets: function(obj) {
    let refresh;
    if(obj.detail.type === 'buy'){
      refresh = () => {
        this.initOwnCoinList(); // 买入成功后，会更新个人的持有选择下拉框
        this.selectComponent("#buy").updateMoney(obj.detail.money);
        this.getRollingInfor();
        console.log('买入成功后，成功后刷新交易信息')
      }
    } else {
      refresh = () => {
        this.initOwnCoinList(); // 卖出成功后，会更新个人的持有选择下拉框
        this.selectComponent("#sale").updateMoney(Utils.DealMyOwn(obj.detail.possess));
        this.getRollingInfor();
        console.log('卖出成功后，成功后刷新交易信息')
      }
    }
    this.setData({
      our: {
        assets: obj.detail.money,
        possess: Utils.DealMyOwn(obj.detail.possess)
      }
    }, refresh);
  },

  // 比赛结束
  GameOver: function(){
    let temp_room = app.globalData.room_num;
    let temp_user = app.globalData.user_id;
    if (temp_room === '') {
      if (this.data.room_num !== '' && this.data.room_num !== undefined) {
        temp_room = this.data.room_num;
      } else {
        wx.getStorage({
          key: 'room_num',
          success: res => {
            temp_room = res.data;
          },
        })
      }
    }
    if (temp_user === '') {
      if (this.data.user_id !== '' && this.data.user_id !== undefined) {
        temp_user = this.data.user_id;
      } else {
        wx.getStorage({
          key: 'user_id',
          success: res => {
            temp_user = res.data;
          },
        })
      }
    }
    console.log('比赛结束')
    wx.request({
      url: app.globalData.ROOTURL + '/game/room/end',
      data: {
        user_id: temp_user,
        room_num: temp_room,
        time: Utils.formatTime(new Date())
      },
      success: res => {
        console.log(res)
        if(res.statusCode === 200) {
          console.log('比赛结束成功，获取结算信息')
          clearTimeout(coinTimer);
          this.setData({
            step: 4,
            myrank: res.data.userRank,
            our:{
              assets: res.data.asset,
              income: res.data.earnMoney,
              yield: res.data.earnRate
            }
          })
          wx.setStorage({
            key: "step",
            data: 4
          });
        } else {
          wx.showToast({
            title: '当场比赛结束失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error(err);
      }
    })
  },

  // 获取上次奖励的情况
  getLastReward: function () {
    console.log('比赛已结束，获取比赛的结算')
    let temp_user = app.globalData.user_id;
    if (temp_user === '') {
      if (this.data.user_id !== '' && this.data.user_id !== undefined) {
        temp_user = this.data.user_id;
      } else {
        wx.getStorage({
          key: 'user_id',
          success: res => {
            temp_user = res.data;
          },
        })
      }
    }
    wx.request({
      url: app.globalData.ROOTURL + '/endInfo',
      data: {
        user_id: temp_user
      },
      success: res => {
        console.log(res)
        if (res.statusCode === 200) {
          console.log('获取比赛结束后的结算信息成功')
          this.setData({
            myrank: res.data.userRank,
            our: {
              assets: res.data.asset,
              income: res.data.earnMoney,
              yield: res.data.earnRate
            }
          })
        } else {
          wx.showToast({
            title: '获取奖励信息失败',
            icon: 'none'
          })
        }
      },
      fail: err => {
        console.error(err);
      }
    })
  },

  // 比赛结束后，再来一局
  AgainGame: function () {
    this.setData({
      isEnterGame: false,
      isStartGame: false,
      step: 1
    })
    wx.setStorage({
      key: "step",
      data: 1
    })
    wx.setStorage({
      key: "isEnterGame",
      data: false
    })
    wx.setStorage({
      key: "isStartGame",
      data: false
    })
    wx.setStorage({
      key: "endTime",
      data: ''
    })
  },

  // 查看游戏规则
  ViewToRegular: function () {
    wx.navigateTo({
      url: '/pages/regular/regular',
    })
  },

  // 查看奖励
  ToMyReward: function () {
    wx.navigateTo({
      url: '/pages/reward/reward',
    })
  },

  //  查看排名
  ToMyRank: function () {
    wx.switchTab({
      url: '/pages/rank/rank',
    })
  }
})




/*** 开赛前的倒计时 ***/
var count_second = 3,
urlList = [
  '../../image/waitgame/count_one.png',
  '../../image/waitgame/count_two.png', 
  '../../image/waitgame/count_three.png'
];

function count_down(that) {
  if (count_second <= 0) {
    that.setData({
      step: 3
    })
    wx.setStorage({
      key: "step",
      data: 3
    })
    that.JugeTheStatus(3);
    return;
  }

  that.setData({
    countURL: urlList[count_second-1],
  });
  setTimeout(function () {
    count_second -= 1;
    count_down(that);
  }, 1000)
}

var countUrlList = [
  '../../image/countdown/6.png', '../../image/countdown/5.png', '../../image/countdown/4.png',
  '../../image/countdown/3.png', '../../image/countdown/2.png', '../../image/countdown/1.png'
]
/*** 比赛结束的倒计时 ***/
function CountOneDay(that) {
  clearTimeout(timer);
  let countIndex = parseInt(total_second / 4800000);
  // 渲染倒计时时钟
  that.setData({
    clockURL: countUrlList[countIndex],
    clock: Utils.dateFormat(total_second)
  });

  if (total_second <= 0) {
    that.setData({
      clock: "00:00:00"
    });
    clearTimeout(timer);
    that.GameOver();
    return;
  }

  timer = setTimeout(function () {
    total_second -= 1000;
    CountOneDay(that);
  }, 1000)
}