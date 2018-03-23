// Meteor Components
import { Random } from 'meteor/random';
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { CurrentClaim } from '/imports/utils/current-claim';
import { Helpers } from '/imports/utils/common';
import { DayPrices } from '/imports/utils/day-prices';
import { log } from '/imports/utils/logging';

// Globals
import {
    CLAIM_WATCH_INTERVAL,
    DAYS_IN_MONTH
} from '/imports/utils/global-constants';

// Template Component
import '/imports/components/loading/loading.component';
import '/imports/components/calendar-day/calendar-day.component';
import './calendar.component.html';

let _claimMonitorId;

Template.calendarComponent.onCreated(function Template_calendarComponent_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    instance.dayIndexRange = [0, 31];
    instance.selectedDayIndex = 0;

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
});

Template.calendarComponent.onDestroyed(function Template_calendarComponent_onDestroyed() {
    if (_claimMonitorId) {
        Meteor.clearTimeout(_claimMonitorId);
    }
});

Template.calendarComponent.helpers({

    isLoaded() {
        const instance = Template.instance();
        return !DayPrices.initialLoad.get();
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

    getCalendarDayData(row, column) {
        const day = Helpers.getDayFromRowCol(row, column);
        const maxDays = DAYS_IN_MONTH[Session.get('selectedMonth')];
        return {
            day : day <= maxDays ? day : false,
            month : Session.get('selectedMonth')
        };
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
