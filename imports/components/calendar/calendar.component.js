// Meteor Components
import { Random } from 'meteor/random';
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { CurrentClaim } from '/imports/utils/current-claim';
import { Helpers } from '/imports/utils/common';
import { log } from '/imports/utils/logging';

// Globals
import {
    PRICE_WATCH_INTERVAL,
    CLAIM_WATCH_INTERVAL,
    HOLIDAY_ICON_MAP,
    DAYS_IN_MONTH
} from '/imports/utils/global-constants';

// Template Component
import '/imports/components/loading/loading.component';
import './calendar.component.html';

let _dayPrices = [];
let _dayOwners = [];
let _priceMonitorId;
let _claimMonitorId;

Template.calendarComponent.onCreated(function Template_calendarComponent_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    instance.loading = new ReactiveVar(true);
    instance.dayIndexRange = [0, 31];
    instance.selectedDayIndex = 0;

    Session.setDefault('calendarUpdatedTrigger', '');

    // Watch changes to Calendar Month
    instance.autorun(() => {
        const selectedMonth = Session.get('selectedMonth');

        // Ensure Valid Day Selected
        let day;
        Tracker.nonreactive(() => { day = Session.get('selectedDay'); });
        day = _.clamp(day, 1, DAYS_IN_MONTH[selectedMonth]);
        Session.setPersistent('selectedDay', day);

        // Get Day-Index Range for Selected Month
        instance.dayIndexRange = Helpers.getDayIndexRange(selectedMonth);
        instance.loading.set(true);
    });

    // Watch changes to Selected Day for Current-Claim
    instance.autorun(() => {
        const selectedMonth = Session.get('selectedMonth');
        const selectedDay = Session.get('selectedDay');

        // Get Day-Index Range for Selected Month
        const range = Helpers.getDayIndexRange(selectedMonth);
        instance.selectedDayIndex = range[0] + selectedDay - 1;
        _monitorClaimPriceAndOwner(instance);
    });

    // Begin Monitoring Prices and Owners
    instance.autorun(() => {
        if (!instance.eth.hasNetwork) { return; }
        Session.get('latestClaim');
        _monitorPricesAndOwners(instance);
        _monitorClaimPriceAndOwner(instance);
    });
});

Template.calendarComponent.onDestroyed(function Template_calendarComponent_onDestroyed() {
    if (_priceMonitorId) {
        Meteor.clearTimeout(_priceMonitorId);
    }
    if (_claimMonitorId) {
        Meteor.clearTimeout(_claimMonitorId);
    }
});

Template.calendarComponent.helpers({

    isLoaded() {
        const instance = Template.instance();
        return !instance.loading.get();
    },

    getCalendarRows() {
        return _.times(5);
    },

    getCalendarColumns() {
        return _.times(7);
    },

    isValidDay(row, column) {
        const day = Helpers.getDayFromRowCol(row, column);
        return day <= DAYS_IN_MONTH[Session.get('selectedMonth')];
    },

    getCalendarDay(row, column) {
        return Helpers.getDayFromRowCol(row, column);
    },

    getSelectedCellClass(row, column) {
        const day = Helpers.getDayFromRowCol(row, column);
        return Session.get('selectedDay') === day ? 'active' : '';
    },

    getDateSquareData(row, column) {
        const day = Helpers.getDayFromRowCol(row, column);
        const maxDays = DAYS_IN_MONTH[Session.get('selectedMonth')];
        return {day : day <= maxDays ? day : false};
    }

});

Template.calendarComponent.events({

    'click [data-select-month]' : (event, instance) => {
        const $target = $(event.currentTarget);
        let month = $target.attr('data-select-month');
        if (/prev/i.test(month)) {
            month = Helpers.getValidMonthIndex(Session.get('selectedMonth') - 1);
        }
        else if (/next/i.test(month)) {
            month = Helpers.getValidMonthIndex(Session.get('selectedMonth') + 1);
        } else {
            month = Helpers.getValidMonthIndex(month);
        }
        Session.setPersistent('selectedMonth', month);
    },

    'click [data-select-cell]' : (event, instance) => {
        const $target = $(event.currentTarget);
        let day = _.parseInt($target.attr('data-select-cell'), 10) || 0;
        day = _.clamp(day, 1, DAYS_IN_MONTH[Session.get('selectedMonth')]);
        Session.setPersistent('selectedDay', day);
    }

});

function _monitorPricesAndOwners(instance) {
    if (!instance.eth.hasNetwork || instance.view.isDestroyed) { return; }
    if (_priceMonitorId) { Meteor.clearTimeout(_priceMonitorId); }

    const start = (new Date).getTime();
    const dayRange = instance.dayIndexRange;

    const promises = [];
    for (let i = dayRange[0]; i < dayRange[1]; i++) {
        promises.push(instance.contract.getDayPrice(i));
        promises.push(instance.contract.getDayOwner(i));
    }
    Promise.all(promises)
        .then(result => {
            _dayPrices = result;
            _dayOwners = _.remove(_dayPrices, function(data) {
                return _.isString(data) && instance.eth.web3.isAddress(data);
            });

            Session.set('calendarUpdatedTrigger', Random.id());

            if (instance.loading.get()) {
                instance.loading.set(false);
            }

            const timeTaken = (new Date).getTime() - start;
            if (timeTaken < PRICE_WATCH_INTERVAL) {
                _priceMonitorId = Meteor.setTimeout(() => _monitorPricesAndOwners(instance), PRICE_WATCH_INTERVAL - timeTaken);
            } else {
                _monitorPricesAndOwners(instance);
            }
        })
        .catch(err => {
            log.error(err);
            _monitorPricesAndOwners(instance);
        });
}

function _monitorClaimPriceAndOwner(instance) {
    if (!instance.eth.hasNetwork || instance.view.isDestroyed) { return; }
    if (_claimMonitorId) { Meteor.clearTimeout(_claimMonitorId); }

    // Update Current Claim Data
    CurrentClaim.month = Session.get('selectedMonth');
    CurrentClaim.day = instance.selectedDayIndex;

    const start = (new Date).getTime();
    instance.contract.getDayPrice(instance.selectedDayIndex)
        .then(result => {
            CurrentClaim.price = result;
            return instance.contract.getDayOwner(instance.selectedDayIndex);
        })
        .then(result => {
            CurrentClaim.ownerAddress = result;
            return Helpers.getFriendlyOwnerName(instance.contract, result);
        })
        .then(result => {
            CurrentClaim.owner = result;
            return instance.contract.getPriceIncrease(CurrentClaim.price);
        })
        .then(result => {
            CurrentClaim.nextPrice = result.add(CurrentClaim.price);
            CurrentClaim.changeTrigger.set(Random.id());

            const timeTaken = (new Date).getTime() - start;
            if (timeTaken < CLAIM_WATCH_INTERVAL) {
                _claimMonitorId = Meteor.setTimeout(() => _monitorClaimPriceAndOwner(instance), CLAIM_WATCH_INTERVAL - timeTaken);
            } else {
                _monitorClaimPriceAndOwner(instance);
            }
        })
        .catch(err => {
            log.error(err);
            _monitorClaimPriceAndOwner(instance);
        });
}



// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Template: calendarDateSquare
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Template.calendarDateSquare.onCreated(function Template_calendarDateSquare_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    instance.ownerAddress = _dayOwners[instance.data.data.day - 1];
    instance.dayToDisplay = new ReactiveVar(instance.data.data.day);
    instance.ownerName = new ReactiveVar(Helpers.shortAddress(instance.ownerAddress));

    instance.autorun(() => {
        const tplData = Template.currentData();
        Session.get('calendarUpdatedTrigger');
        instance.dayToDisplay.set(tplData.data.day);
        instance.ownerAddress = _dayOwners[tplData.data.day - 1];

        // Get Index of Day
        const selectedMonth = Session.get('selectedMonth');
        const range = Helpers.getDayIndexRange(selectedMonth);
        instance.dayIndex = range[0] + instance.data.data.day - 1;

        Helpers.getFriendlyOwnerName(instance.contract, instance.ownerAddress)
            .then(name => instance.ownerName.set(name))
            .catch(log.error);
    });
});

Template.calendarDateSquare.onRendered(function Template_calendarDateSquare_onRendered() {
    Meteor.defer(() => $('[data-toggle="popover"]').popover({trigger: 'hover'}));
});

Template.calendarDateSquare.helpers({

    getDay() {
        const instance = Template.instance();
        return instance.dayToDisplay.get();
    },

    getCurrentPrice() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }
        Session.get('calendarUpdatedTrigger');

        const dayIndex = instance.dayToDisplay.get() - 1;
        const priceObj = _dayPrices[dayIndex];
        return instance.eth.web3.fromWei(priceObj, 'ether').toString(10);
    },

    getCurrentOwner() {
        const instance = Template.instance();
        const ownerName = instance.ownerName.get();
        if (Helpers.isAddressZero(instance.ownerAddress)) { return ''; }
        return ownerName;
    },

    getColorFromAddress() {
        const instance = Template.instance();
        Session.get('calendarUpdatedTrigger');
        return Helpers.getStylesForAddress(instance.ownerAddress);
    },

    hasHoliday() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex;
        return !_.isUndefined(_.find(HOLIDAY_ICON_MAP, {dayIndex}));
    },

    getHolidayIcon() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex;
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return holiday.img;
    },

    getHolidayTitle() {
        const instance = Template.instance();
        TAPi18n.getLanguage();
        const dayIndex = instance.dayIndex;
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return TAPi18n.__(holiday.title);
    },

    getHolidayDesc() {
        const instance = Template.instance();
        TAPi18n.getLanguage();
        const dayIndex = instance.dayIndex;
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return TAPi18n.__(holiday.desc);
    }

});
