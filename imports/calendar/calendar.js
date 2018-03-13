// Meteor Components
import { _ } from 'lodash';

// Template Components
import '/imports/components/calendar/calendar.component';
import '/imports/components/claim/claim.component';
import '/imports/components/account-warning/account-warning.component';
import './calendar.html';


Template.calendar.onRendered(function Template_calendar_onRendered() {
    // Set Page Title
    Meta.setSuffix(TAPi18n.__('calendar.pageTitle'));
});
