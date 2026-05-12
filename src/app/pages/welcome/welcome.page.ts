import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: false,
})
export class WelcomePage implements OnInit {

  constructor() { }

  colors = [
    { value: 'color-primary', label: 'Default' },
    { value: 'color-green', label: 'Green' },
    { value: 'color-blue', label: 'Blue' },
    { value: 'color-pink', label: 'Pink' },
    { value: 'color-yellow', label: 'Yellow' },
    { value: 'color-orange', label: 'Orange' },
    { value: 'color-purple', label: 'Purple' },
    { value: 'color-red', label: 'Red' },
    { value: 'color-lightblue', label: 'Lightblue' },
    { value: 'color-teal', label: 'Teal' },
    { value: 'color-lime', label: 'Lime' },
    { value: 'color-deeporange', label: 'Deeporange' }
  ];

  ngOnInit() {
  }

}
