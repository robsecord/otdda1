// Meteor Components
import { Random } from 'meteor/random';
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { log } from '/imports/utils/logging';

// Globals
import {
    TOTAL_DAYS,
    DAYS_WATCH_INTERVAL
} from '/imports/utils/global-constants';

// Template Component
import '/imports/components/day-card/day-card.component';
import './my-days.component.html';

let _daysMonitorId;
let _lastKnownAccount = '';


Template.myDaysComponent.onCreated(function Template_myDaysComponent_onCreated(){
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();
    instance.loading = new ReactiveVar(true);

    instance.ownedDays = new ReactiveVar([]);

    // Begin Monitoring Days Owned
    instance.autorun(() => {
        if (_.isEmpty(_lastKnownAccount) || _lastKnownAccount !== instance.eth.coinbase) {
            _lastKnownAccount = instance.eth.coinbase;
            instance.loading.set(true);
        }
        if (!instance.eth.hasAccount) { return; }
        Meteor.defer(() => {
            _monitorDaysOwned(instance);
        });
    });
});

Template.myDaysComponent.onDestroyed(function Template_myDaysComponent_onDestroyed() {
    if (_daysMonitorId) {
        Meteor.clearTimeout(_daysMonitorId);
    }
});

Template.myDaysComponent.helpers({

    isLoading() {
        const instance = Template.instance();
        return instance.loading.get();
    },

    ownsDays() {
        const instance = Template.instance();
        return instance.ownedDays.get().length > 0;
    },

    getDaysOwned() {
        const instance = Template.instance();
        return instance.ownedDays.get();
    }

});


function _monitorDaysOwned(instance) {
    if (!instance.eth.hasAccount || instance.view.isDestroyed) { return; }
    if (_daysMonitorId) { Meteor.clearTimeout(_daysMonitorId); }

    const days = [];
    let responseCount = 0;
    const start = (new Date).getTime();

    const _checkOwner = (owner, dayIndex) => {
        responseCount++;
        if (!_.isEqual(owner, instance.eth.coinbase)) { return; }
        days.push(dayIndex);
    };

    const _handleError = (err, dayIndex) => {
        responseCount++;
        log.error(`Days Monitor: Unexpected error at index: ${dayIndex};`, err);
    };

    const _onComplete = () => {
        if (responseCount < TOTAL_DAYS) { return; }
        instance.loading.set(false);

        // Update Days-Owned
        days.sort((a, b) => a - b);
        instance.ownedDays.set(days);

        // Continue Watching
        const timeTaken = (new Date).getTime() - start;
        if (timeTaken < DAYS_WATCH_INTERVAL) {
            _daysMonitorId = Meteor.setTimeout(() => _monitorDaysOwned(instance), DAYS_WATCH_INTERVAL - timeTaken);
        } else {
            _monitorDaysOwned(instance);
        }
    };

    for (let i = 0; i < TOTAL_DAYS; i++) {
        instance.contract.getDayOwner(i)
            .then(owner => _checkOwner(owner, i))
            .catch(err => _handleError(err, i))
            .finally(_onComplete);
    }
}