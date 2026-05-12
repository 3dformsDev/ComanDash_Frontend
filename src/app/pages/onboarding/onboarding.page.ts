import { Component, OnInit } from '@angular/core';
import { register } from 'swiper/element/bundle';

register();


@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
