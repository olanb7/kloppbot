"use strict"

const _ = require('underscore-plus');

class Event {

  constructor() {
    this.store = [];
  }

  add(date) {
    this.store.push({
      date: date,
      attendees: ['thenry']
    });
  }

  get(date) {
    return _.filter(this.store, function(s) {
      return s.date.toISOString() == date.toISOString();
    })[0];
  }

  getNext() {
    return this.get(this._getNextDate());
  }

  _getNextDate() {
    let now = new Date();
    let events = this.sort();
    let next = new Date();

    next.setDate(now.getDate() + 10000);

    for (var i = events.length - 1 ; i >= 0; i--) {

      if (events[i].date > now && events[i].date < next) {
        next = events[i].date;
      }
    }

    if (next == now) {
      return false;
    }

    return next;
  }

  sort() {
    return this.store.sort(function(a, b){
      var keyA = new Date(a.date),
          keyB = new Date(b.date);
      // Compare the 2 dates
      if(keyA < keyB) return -1;
      if(keyA > keyB) return 1;
      return 0;
    });
  }

  // user stuff

  addParticipant(userId, date) {
    if (!date) {
      date = this._getNextDate();
    }
    let evt = this.get(date);

    let attendees = evt.attendees || [];

    if (_.contains(attendees, userId)) {
      return false;
    }

    attendees.push(userId);
    _.extend(evt, { attendees: attendees });
    return true;
  }

  listParticipants(date) {
    if (!date) {
      date = this._getNextDate();
    }
    let evt = this.get(date);

    return evt.attendees || [];

  }

}

module.exports = Event;
