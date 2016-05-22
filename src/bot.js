const rx = require('rx');
const _ = require('underscore-plus');
const chrono = require('chrono-node');
const moment = require('moment');

const SlackRtmClient  = require('@slack/client').RtmClient;
const CLIENT_EVENTS   = require('@slack/client').CLIENT_EVENTS;
const RTM_EVENTS      = require('@slack/client').RTM_EVENTS;
const MemoryDataStore = require('@slack/client').MemoryDataStore;

const Events = require('./event');
const MessageHelpers = require('./message-helpers');

var ADMINS = ['obyrne'];

const momentCalFmt = {
    sameDay: '[today] at ',
    nextDay: '[tomorrow]',
    nextWeek: 'dddd',
    lastDay: '[yesterday]',
    lastWeek: '[last] dddd',
    sameElse: '[at] DD/MM/YYYY'
}

"use strict"
class Bot {

  // Public: Creates a new instance of the bot.
  //
  // token - An API token from the bot integration
  constructor(token) {
    this.slack = new SlackRtmClient(token, {
      // Sets the level of logging we require
      logLevel: 'info',
      // Initialise a data store for our client, this will load additional helper functions for the storing and retrieval of data
      dataStore: new MemoryDataStore(),
      // Boolean indicating whether Slack should automatically reconnect after an error response
      autoReconnect: true,
      // Boolean indicating whether each message should be marked as read or not after it is processed
      autoMark: true
    });

    this.events = new Events();
  }

  // Public: Brings this bot online and starts handling messages sent to it.
  login() {

    rx.Observable.fromEvent(this.slack, CLIENT_EVENTS.RTM.AUTHENTICATED).subscribe((rtmStartData) => this.onAuth(rtmStartData));

    this.slack.start();
    this.respondToMessages();
  }

  onAuth(rtmStartData) {
    console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
  }

  // sets up some message listeners
  respondToMessages() {
    let messages = rx.Observable.fromEvent(this.slack, RTM_EVENTS.MESSAGE);

    messages.where(e => (function(e) { let re = /kloppbot/i; return re.test(e.text) } )(e) )
            .where(e => this.fromAdmin(e))
            .subscribe((message) => this.handleNewEvent(message));

    messages.where(e => (function(e) { let re = /i'?(m|ll) *(in|play|playing)/i; return re.test(e.text) } )(e) )
            .subscribe((message) => this.handleNewSignup(message));

    messages.where(e => (function(e) { let re = /who(\'?s| is) playing/i; return re.test(e.text) } )(e) )
            .subscribe((message) => this.handleListAttendees(message));

    messages.where(e => (function(e) { let re = /fixture list/i; return re.test(e.text) } )(e) )
            .subscribe((message) => this.handleListEvents(message));

    messages.where(e => (function(e) { let re = /next game/i; return re.test(e.text) } )(e) )
            .subscribe((message) => this.handleNextEvent(message));
  }

  fromAdmin(message) {
    var user = this.slack.dataStore.getUserById(message.user);
    if (!user) return;

    if (!_.contains(ADMINS, user.name)) {
      this.slack.sendMessage('Nein! You need to be an admin to do that.', message.channel);
      return;
    }

    return true;
  }

  handleNewEvent(message) {
    let date = chrono.parseDate(message.text);
    if (!date) return;

    this.slack.sendMessage('Ok, ja, I\'ll see who can play on ' + moment(date).format('lll'), message.channel);
    this.events.add(date);

    let reminder = moment(date).subtract(20, 'mins');

    // schedule a reminder
    rx.Scheduler.default.scheduleFuture('world', reminder.toDate(), (scheduler, x) => {
      this.slack.sendMessage('<@channel> time to go. Since we\'re here anyway, we might actually play a bit of football.', message.channel);
    });
  }

  handleNewSignup(message) {
    // Get the user's name
    var user = this.slack.dataStore.getUserById(message.user);

    if (this.events.addParticipant(user.name)) {
      this.slack.sendMessage('Great ' + user.name + ', you\'re signed up!', message.channel);
    } else {
      this.slack.sendMessage('You\'ve already signed up ' + user.name, message.channel);
    }

  }

  handleNextEvent(message) {
    let evt = this.events.getNext();
    let msg = 'The next game is ' + moment(evt.date).calendar(null, momentCalFmt) + '.';
    this.slack.sendMessage(msg, message.channel);
  }

  handleListEvents(message) {
    let evts = this.events.sort();
    let msg = 'There are ' + evts.length + ' planned:\n\n';

    for (let i = 0; i < evts.length; i++) {
      msg += '• ' + moment(evts[i].date).format('llll') + '\n';
    }

    this.slack.sendMessage(msg, message.channel);
  }

  handleListAttendees(message) {
    let users = this.events.listParticipants();
    let evt = this.events.getNext();
    let msg = '';

    if (!users.length) {
      msg = 'Nobody has signed up yet!';
    } else if (users.length == 1) {
      msg = 'So far, just ' + users[0] + ' is playing ' + moment(evt.date).calendar(null, momentCalFmt);
    } else {
      msg = 'So far we\'ve got ' + users.length + ' - ' + this.niceList(users) + ' for the game ' + moment(evt.date).calendar(null, momentCalFmt) + '.';
    }

    if (users.length >= 10) {
      msg += ' Hmm. That\'s over ten.'
    } else if (users.length >= 6 && (users.length % 2 != 0) ) {
      msg += ' Someone needs to make these teams even.'
    }

    this.slack.sendMessage(msg, message.channel);
  }

  // convenience method - move this
  niceList(array, join, finalJoin) {
    var arr = array.slice(0), last = arr.pop();
    join = join || ', ';
    finalJoin = finalJoin || ' and ';
    return arr.join(join) + finalJoin + last;
  }

}

module.exports = Bot;
