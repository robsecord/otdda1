// Meteor Components
import { FlowRouter } from 'meteor/kadira:flow-router';
import { TAPi18n } from 'meteor/tap:i18n';
import { Random } from 'meteor/random';
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { PendingTransactions } from '/imports/utils/pending-transactions';
import { LocaleHelpers } from '/imports/utils/i18n-helpers';
import { Helpers } from '/imports/utils/common';
import { DayPrices } from '/imports/utils/day-prices';
import { log } from '/imports/utils/logging';

// Globals
import {
    TOTAL_DAYS,
    PRICE_WATCH_INTERVAL,
    ACCOUNT_WATCH_INTERVAL
} from '/imports/utils/global-constants';

// Template Components
import '/imports/modals/error/error.modal';
import '/imports/modals/nickname/nickname.modal';
import '/imports/modals/claim/claim.modal';
import './body.html';

let _priceMonitorId;
let _accountMonitorId;

Template.bodyLayout.onCreated(function Template_bodyLayout_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    Session.setDefaultPersistent('selectedMonth', 0);
    Session.setDefaultPersistent('selectedDay', 1);
    Session.setDefault('accountNickname', '');
    Session.setDefault('latestClaim', {});

    // Monitor Existing Transactions
    instance.autorun(computation => {
        if (!instance.eth.hasNetwork) { return; }
        PendingTransactions.monitor(instance.contract);
        computation.stop();
    });

    let lastKnownCoinbase = '';
    instance.autorun(computation => {
        if (!instance.eth.hasNetwork) { return; }
        computation.stop();

        // Let's watch the Coinbase Account of the User
        _accountMonitorId = Meteor.setInterval(function () {
            const coinbase = instance.eth.web3.eth.coinbase;

            // Check if the Coinbase Account has changed
            if (lastKnownCoinbase === coinbase) { return; }
            lastKnownCoinbase = coinbase;

            // Reactively update the Coinbase Account
            instance.eth.coinbase = coinbase;
            instance.eth.hasAccount = !_.isEmpty(coinbase);

            // Get Account Nickname (if any)
            _getAccountNickname(instance);
        }, ACCOUNT_WATCH_INTERVAL);
    });

    // Begin Monitoring All Prices
    instance.autorun(() => {
        if (!instance.eth.hasNetwork) { return; }
        _monitorPrices(instance);
    });

    // Update Price after a Claim
    instance.autorun(() => {
        if (!instance.eth.hasNetwork) { return; }
        _updatePriceAfterClaim(instance, Session.get('latestClaim'));
    });
});

Template.bodyLayout.onRendered(function Template_bodyLayout_onRendered() {
    // Set Page Desc
    Meta.set('description', TAPi18n.__('page.desc'));

    Meteor.defer(() => {
        $('.dropdown-toggle').dropdown();
        $('[data-toggle="tooltip"]').tooltip();
    });

    // if (/development/i.test(process.env.NODE_ENV)) {
    //     for (let i = 0; i < 366; i++) {
    //         const {month, day} = Helpers.getMonthDayFromIndex(i);
    //         console.log(i, ' = ', month + 1, day);
    //     }
    // }
});

Template.bodyLayout.onDestroyed(function Template_bodyLayout_onDestroyed() {
    if (_priceMonitorId) {
        Meteor.clearInterval(_priceMonitorId);
    }
    if (_accountMonitorId) {
        Meteor.clearInterval(_accountMonitorId);
    }
});

Template.bodyLayout.helpers({

    getAccountAddress() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount) { return ''; }
        return instance.eth.coinbase;
    },

    getCalendarRoute() {
        return FlowRouter.path('calendar');
    },

    getAccountRoute() {
        return FlowRouter.path('account');
    },

    getActiveClass(route) {
        return (_.endsWith(FlowRouter.getRouteName(), route)) ? 'active' : '';
    },

    getAccountNickname() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount) { return ''; }
        return Session.get('accountNickname');
    },

    getColorFromAddress() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount) { return ''; }
        return Helpers.getStylesForAddress(instance.eth.coinbase);
    },

    hasRecentClaim() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount) { return ''; }
        return !_.isEmpty(Session.get('latestClaim'));
    },

    hasPendingTxs() {
        return PendingTransactions.getTransactionCount() > 0;
    },

    getPendingTxs() {
        return PendingTransactions.getTransactions(); // [{hash: '0xa80a97cd70acfd783a3ba008b1b038759702327055a2d97e080bb5a8af730c91', claimData: {day: 1}}]
    },

    getFriendlyDate(tx) {
        const {month, day} = Helpers.getMonthDayFromIndex(tx.claimData.day);
        return LocaleHelpers.formatDate('MMMM Do', month, day);
    }

});

Template.bodyLayout.events({

    'click .dropdown-toggle': event => { event.preventDefault(); },

    'click [href="#"]': event => { event.preventDefault(); },

    'click [data-action="change-lang"]' : event => {
        const $target = $(event.currentTarget);
        LocaleHelpers.setLanguage($target.attr('data-lang') || 'en');
    }

});

/**
 * @summary
 * @param instance
 * @private
 */
function _getAccountNickname(instance) {
    if (instance.view.isDestroyed || _.isEmpty(instance.eth.coinbase)) { return; }

    // Use Address as Nickname
    Session.set('accountNickname', Helpers.shortAddress(instance.eth.coinbase));

    // Get Nickname from Contract
    Helpers.getFriendlyOwnerName(instance.contract, instance.eth.coinbase)
        .then(name => Session.set('accountNickname', name))
        .catch(log.error);
}

/**
 * @summary
 * @param instance
 * @param idx
 * @returns {function(*)}
 * @private
 */
const _addPrice = function Template_bodyLayout_monitorPrices_addPrice(instance, idx) {
    return (price) => {
        if (_.isUndefined(DayPrices.prices[idx])) {
            DayPrices.prices[idx] = {price: 0, changed: new ReactiveVar('')};
            DayPrices.owners[idx] = {address: 0, changed: new ReactiveVar('')};
        }

        if (!DayPrices.prices[idx].price || !price.eq(DayPrices.prices[idx].price)) {
            DayPrices.prices[idx].price = price;
            DayPrices.prices[idx].changed.set(Random.id());
            instance.contract.getDayOwner(idx)
                .then(owner => {
                    DayPrices.owners[idx].address = owner;
                    DayPrices.owners[idx].changed.set(Random.id());
                });
        }
    };
};

/**
 * @summary
 * @param prices
 * @param priceToFind
 * @returns {Array}
 * @private
 */
const _getIndicesOf = (prices, priceToFind) => {
    const indices = [];
    _.forEach(prices, (priceObj, i) => {
        if (priceObj.price.eq(priceToFind)) {
            indices.push(i);
        }
    });
    return indices;
};

/**
 * @summary
 * @param prices
 * @param isGreaterCallback
 * @returns {*}
 * @private
 */
const _getMaxPriceBy = (prices, isGreaterCallback) => {
    let maxPrice = {price: new BigNumber(0)};
    _.forEach(prices, (priceObj) => {
        if (isGreaterCallback(priceObj.price, maxPrice.price)) {
            maxPrice = priceObj;
        }
    });
    return maxPrice;
};

const _updateLeaders = () => {
    // Get Leading Prices
    const firstHigh = _getMaxPriceBy(DayPrices.prices, (price, max) => price.gt(max));
    const secondHigh = _getMaxPriceBy(DayPrices.prices, (price, max) => price.eq(firstHigh.price) ? false : price.gt(max));
    const thirdHigh = _getMaxPriceBy(DayPrices.prices, (price, max) => (price.eq(firstHigh.price) || price.eq(secondHigh.price)) ? false : price.gt(max));

    // Get Indices of Leading Prices
    const firstHighDays = _getIndicesOf(DayPrices.prices, firstHigh.price);
    const secondHighDays = _getIndicesOf(DayPrices.prices, secondHigh.price);
    const thirdHighDays = _getIndicesOf(DayPrices.prices, thirdHigh.price);

    // Check if Leaders have changed
    let hasChanges = false;
    if (!DayPrices.leaders.first.price || !DayPrices.leaders.first.price.eq(firstHigh.price)) { hasChanges = true; }
    if (!DayPrices.leaders.second.price || !DayPrices.leaders.second.price.eq(secondHigh.price)) { hasChanges = true; }
    if (!DayPrices.leaders.third.price || !DayPrices.leaders.third.price.eq(thirdHigh.price)) { hasChanges = true; }
    if (DayPrices.leaders.first.days.length !== firstHighDays.length) { hasChanges = true; }
    if (DayPrices.leaders.second.days.length !== secondHighDays.length) { hasChanges = true; }
    if (DayPrices.leaders.third.days.length !== thirdHighDays.length) { hasChanges = true; }

    // Store Leading Prices and Indices
    DayPrices.leaders.first.price = firstHigh.price;
    DayPrices.leaders.second.price = secondHigh.price;
    DayPrices.leaders.third.price = thirdHigh.price;
    DayPrices.leaders.first.days = firstHighDays.slice(0);
    DayPrices.leaders.second.days = secondHighDays.slice(0);
    DayPrices.leaders.third.days = thirdHighDays.slice(0);

    return hasChanges;
};

/**
 * @summary
 * @param instance
 * @private
 */
function _monitorPrices(instance) {
    if (!instance.eth.hasNetwork || instance.view.isDestroyed) { return; }
    if (_priceMonitorId) { Meteor.clearTimeout(_priceMonitorId); }

    const start = (new Date).getTime();
    const promises = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
        promises.push(instance.contract.getDayPrice(i).then(_addPrice(instance, i, true)));
    }
    Promise.all(promises)
        .then(result => {
            // Check if Leaders have changed
            let hasChanges = _updateLeaders();

            // Finished Initial Load
            DayPrices.initialLoad.set(false);

            // Trigger Leaderboard Changes
            if (hasChanges) {
                DayPrices.leaders.changed.set(Random.id());
            }

            // Re-run Monitor
            const timeTaken = (new Date).getTime() - start;
            if (timeTaken < PRICE_WATCH_INTERVAL) {
                _priceMonitorId = Meteor.setTimeout(() => _monitorPrices(instance), PRICE_WATCH_INTERVAL - timeTaken);
            } else {
                _monitorPrices(instance);
            }
        })
        .catch(err => {
            log.error(err);
            _monitorPrices(instance);
        });
}


/**
 * @summary
 * @param instance
 * @private
 */
function _updatePriceAfterClaim(instance, latestClaim) {
    if (!instance.eth.hasNetwork || instance.view.isDestroyed) { return; }
    if (_.isEmpty(latestClaim)) { return; }

    instance.contract.getDayPrice(latestClaim.day)
        .then(_addPrice(instance, latestClaim.day))
        .then(() => {
            if (_updateLeaders()) {
                DayPrices.leaders.changed.set(Random.id());
            }
        })
        .catch(err => {
            log.error(err);
            _monitorPrices(instance);
        });
}
