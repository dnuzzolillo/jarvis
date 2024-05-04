window.som = () => {

  const V_ID_ATTR_NAME = 'v-id';

  getColor = (i) => {
    // colors need to be dark enough for white text to be visible
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ff8000', '#ff0080', '#80ff00', '#0080ff', '#8000ff', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#808080', '#c0c0c0', '#8080ff', '#80ff80', '#ff8080', '#ff80ff', '#80ffff', '#ff80c0', '#80c0ff'];
    return colors[i % colors.length];
  }

  function querySelectorAllIncludingShadowDom(selector, startElement) {
    let elements = Array.from(startElement.querySelectorAll(selector));
    const shadowRoots = elements.filter((el) => el.shadowRoot);
    const iframes = elements.filter((el) => el.tagName === 'IFRAME');

    for (const root of shadowRoots) {
      elements = [
        ...elements,
        ...querySelectorAllIncludingShadowDom(selector, root.shadowRoot)
      ]
    }

    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const iframeElements = querySelectorAllIncludingShadowDom(selector, iframeDoc);
        iframeElements.forEach(el => el.iframeOwner = iframe);
        elements = [
          ...elements,
          ...querySelectorAllIncludingShadowDom(selector, iframeDoc)
        ]
      } catch (e) {
        // ignore cross-origin iframes
      }
    }
    
    return elements;
  }

  function getTextsInElement(el) {
    let text = '';
    el.childNodes.forEach(node => {
      if (node.nodeType === 3) {
        // avoid empty string or white spaces or new lines or aspace and new line
        if (node.textContent.trim()) {
          text += node.textContent;
        }
        //text += node.textContent;
      } else {
        if (nodeTextIsVisible(node)) {
          text += getTextsInElement(node);
        }
      }
    });
    return text.trim();
  }

  getDefaltElementAttrs = (el) => {
    const hint = el.getAttribute('v-id');
    const text = getTextsInElement(el).substring(0, 50);
    const ariaLabel = el.getAttribute('aria-label');
    const role = el.getAttribute('role');
    const interactionType = 'click';
    return { elementId: hint, text, ariaLabel, role, interactionType };
  }

  getInputElementAttrs = (el) => {
    const placeholder = el.getAttribute('placeholder');
    const ariaLabel = el.getAttribute('aria-label');
    const type = el.getAttribute('type');
    const labelFor = el.getAttribute('id') && document.querySelector(`label[for="${el.getAttribute('id')}"]`)?.innerText;
    const value = el.value || '';
    const name = el.getAttribute('name');
    const hint = el.getAttribute('v-id');
    const interactionType = 'type';
    return { placeholder, value, ariaLabel, type, labelFor, name, elementId: hint, interactionType };
  }

  getScrollableElementAttrs = (el) => {
    const hint = el.getAttribute('v-scroll-id');
    const percentScrolled = Math.round(el.scrollTop / (el.scrollHeight - el.offsetHeight)) + '%';
    const hScreenSide = getSideOfTheScreen(el).horizontalSide;
    const vScreenSide = getSideOfTheScreen(el).verticalSide;
    const interactionType = 'scroll';
    console.log('el', el);
    return { elementId: hint, scrolled: percentScrolled, vScreenSide, hScreenSide, interactionType };
  }

  getElementRectClone = (el) => {
    return {
      top: el.getBoundingClientRect().top,
      left: el.getBoundingClientRect().left,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height
    }
  }

  getElementsAttrs = (el) => {
    if (elementIsInput(el)) {
      return getInputElementAttrs(el);
    } else if (el.hasAttribute('v-scroll-id')) {
      return getScrollableElementAttrs(el);
    }
    return getDefaltElementAttrs(el);
  }

  getSideOfTheScreen = (element) => {
    const rect = element.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const horizontalCenter = rect.left + rect.width / 2;
    const verticalCenter = rect.top + rect.height / 2;
    const horizontalSide = horizontalCenter < windowWidth / 2 ? 'left' : 'right';
    const verticalSide = verticalCenter < windowHeight / 2 ? 'top' : 'bottom';
    return { horizontalSide, verticalSide };
  }

  const getSequenceFromNum = (num) => {
    const startChar = 'a'.charCodeAt(0);
    const alphabetLength = 26;
    let length = 1;
    let range = alphabetLength;
    while (num > range) {
      num -= range;
      length++;
      range = alphabetLength ** length;
    }
    let result = '';
    num--;
    for (let i = 0; i < length; i++) {
      result = String.fromCharCode(startChar + (num % alphabetLength)) + result;
      num = Math.floor(num / alphabetLength);
    }

    return result;
  }

  function nodeTextIsVisible(el) {
    if(!el.getBoundingClientRect) {
      return false;
    }
    var rect = el.getBoundingClientRect();
    var isVisible = rect.top >= 0 && rect.left >= 0 && (rect.top) <= (window.innerHeight || document.documentElement.clientHeight) && (rect.left) <= (window.innerWidth || document.documentElement.clientWidth);
    
    if (!isVisible) {
      return false;
    }
    let tempEl = el;
  
    while (tempEl) {
      const elComputedStyle = window.getComputedStyle(el);
      const elDisplay = elComputedStyle.getPropertyValue('display');
      const elVisibility = elComputedStyle.getPropertyValue('visibility');
      const elOpacity = elComputedStyle.getPropertyValue('opacity');
      if (elDisplay === 'none' || elVisibility === 'hidden' || elOpacity === '0') {
        return false;
      }
      tempEl = tempEl.parentElement;
    }
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var elementAtCenter = (el.iframeOwner?.contentDocument || el.iframeOwner?.contentWindow.document || document).elementFromPoint(centerX, centerY);
    
    const isInShadowDom = elementAtCenter?.shadowRoot && (() => {
      const maxDepth = 10; // prevent infinite loops
      let depth = 0;
      let tempElement = elementAtCenter?.shadowRoot || null;
      while (tempElement !== null && depth < maxDepth) {
        depth++;
        if (tempElement.contains(el)) {
          return true;
        }
        const deeperElement = tempElement.elementFromPoint(centerX, centerY)?.shadowRoot || null;
        tempElement = deeperElement == tempElement ? null : deeperElement;
      }
      return false;
    })();
    
    return (elementAtCenter === el || el?.contains(elementAtCenter) || isInShadowDom);
  }


  function isTrulyVisible(el) {
    var rect = el.getBoundingClientRect();
    var isVisible = rect.top >= 0 && rect.left >= 0 && (rect.top) <= (window.innerHeight || document.documentElement.clientHeight) && (rect.left) <= (window.innerWidth || document.documentElement.clientWidth);
    
    if (!isVisible) {
      return false;
    }
    let tempEl = el;
  
    while (tempEl) {
      const elComputedStyle = window.getComputedStyle(el);
      const elDisplay = elComputedStyle.getPropertyValue('display');
      const elVisibility = elComputedStyle.getPropertyValue('visibility');
      const elOpacity = elComputedStyle.getPropertyValue('opacity');
      const exitingId = tempEl.getAttribute('v-id');
      const acceptedRoles = ['button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'checkbox', 'radio', 'switch'];
      const elementIsInteractive = (['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(el.tagName) || (el.getAttribute('role') && acceptedRoles.includes(el.getAttribute('role'))));
      const elementIsInsideInteractive = elemntAIsInsideElementB(el, tempEl);
      if (exitingId && !elementIsInteractive && elementIsInsideInteractive) {
        return false;
      }
      if (elDisplay === 'none' || elVisibility === 'hidden' || elOpacity === '0') {
        
        return false;
      }
      isFirstChild = false;
      tempEl = tempEl.parentElement;
    }
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var elementAtCenter = (el.iframeOwner?.contentDocument || el.iframeOwner?.contentWindow.document || document).elementFromPoint(centerX, centerY);
    
    const isInShadowDom = elementAtCenter?.shadowRoot && (() => {
      const maxDepth = 10; // prevent infinite loops
      let depth = 0;
      let tempElement = elementAtCenter?.shadowRoot || null;
      while (tempElement !== null && depth < maxDepth) {
        depth++;
        if (tempElement.contains(el)) {
          return true;
        }
        const deeperElement = tempElement.elementFromPoint(centerX, centerY)?.shadowRoot || null;
        tempElement = deeperElement == tempElement ? null : deeperElement;
      }
      return false;
    })();
    
    return (elementAtCenter === el || el?.contains(elementAtCenter) || isInShadowDom);
  }

  function isClickeable(el) {
    const cursor = window.getComputedStyle(el).cursor;
    // white list of elements that are clickeable
    const acceptedRoles = ['button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'checkbox', 'radio', 'switch', 'treeitem', 'gridcell'];
    if (['A', 'BUTTON', 'SELECT'].includes(el.tagName)
      || (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.getAttribute('type')))
      || (el.getAttribute('role') && acceptedRoles.includes(el.getAttribute('role')))
      || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === ''
      || (el.getAttribute('for') && document.getElementById(el.getAttribute('for')) && document.getElementById(el.getAttribute('for')).tagName === 'INPUT')
    ) {
      return true;
    }
    // black list of elements that are not clickeable
    // when ul is clickeable but the li is clickeable as well
    if (el.tagName === 'UL' && Array.from(el.children).some(child => child.tagName === 'LI' && isClickeable(child))) {
      return false;
    }
    return cursor === 'pointer' || cursor === 'text';
  }

  function elemntAIsInsideElementB(a, b) {
    // check if element a bounds are inside element b bounds
    const aRect = getElementRectClone(a);
    const bRect = getElementRectClone(b);
    return (bRect.top + bRect.height) > aRect.top && (bRect.left + bRect.width) > aRect.left;
  }

  function elementIsScrollable(element) {
    const overflowY = window.getComputedStyle(element).overflowY;
    const overflowX = window.getComputedStyle(element).overflowX;
    const isScrollableY = overflowY !== 'visible' && overflowY !== 'hidden' && element.scrollHeight > element.clientHeight;
    const isScrollableX = overflowX !== 'visible' && overflowX !== 'hidden' && element.scrollWidth > element.clientWidth;

    // check if is has overflowed content
    const contentHeight = element.scrollHeight;
    const contentWidth = element.scrollWidth;

    const isOverflowedY = contentHeight > element.clientHeight;
    const isOverflowedX = contentWidth > element.clientWidth;

    return (isScrollableY && isOverflowedY) || (isScrollableX && isOverflowedX);
  }

  function windowIsScrollable() {
    // check if the window is scrollable
    window.scrollTo(0, window.scrollY + 1);
    const isScrollable = window.scrollY > 0;
    window.scrollTo(0, window.scrollY - 1);
    return isScrollable;
  }

  elementIsInput = (element) => {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) && !(['button', 'submit', 'reset'].includes(element.getAttribute('type')));
  }

  // delete all prev spans
  document.querySelectorAll('span.vision-hint').forEach(e => e.remove());
  document.querySelectorAll('.vision-segment').forEach(e => e.remove());
  // delete all prev v-id attributes and v-scroll-id
  document.querySelectorAll('[v-id]').forEach(el => el.removeAttribute('v-id'));
  document.querySelectorAll('[v-scroll-id]').forEach(el => el.removeAttribute('v-scroll-id'));

  let hintId = 1;
  let jsonMap = {};
  let xmlMap = '';

  if(windowIsScrollable()){
    const windowXml = `<body scrolled="${Math.round((window.scrollY / (document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight)) * 100) + '%'}"/>`;
    xmlMap += windowXml;
    window.scrolledPercentage = Math.round((window.scrollY / (document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight)) * 100) + '%';
  } else {
    // find the largest scrollable element
    const scrollableElements = querySelectorAllIncludingShadowDom('*', document).filter(el => elementIsScrollable(el));
    let largestScrollableElement = null;
    let largestScrollableElementArea = 0;
    scrollableElements.forEach(el => {
      const area = el.clientHeight * el.clientWidth;
      if (area > largestScrollableElementArea) {
        largestScrollableElement = el;
        largestScrollableElementArea = area;
      }
    });
    if (largestScrollableElement) {
      const scrollableElementAttrs = getScrollableElementAttrs(largestScrollableElement);
      xmlMap += `<body scrolled="${scrollableElementAttrs.scrolled}"/>`;
    }
    window.scrolledPercentage = scrollableElementAttrs.scrolled;
  }


  const allElements = querySelectorAllIncludingShadowDom('*', document);
  //remove the dialog if it exists
  const dialogElement = document.getElementById('vision-dialog');
  if (dialogElement) {
    dialogElement.remove();
  }
  // create a dialog as host for the hints
  const dialog = document.createElement('dialog');
  dialog.setAttribute('id', 'vision-dialog');
  allElements.forEach((element, i) => {
    // ignore input type hidden
    if (element.type === 'hidden') {
      return;
    }
    if(elementIsScrollable(element)){
      console.log('element', element);
    }
    // ignore invisible elements or elements without cursor pointer ot non scrollable elements
    if (!isTrulyVisible(element) || (!isClickeable(element) && !elementIsScrollable(element))) {
      return;
    }
    // get the color
    const color = getColor(hintId);

    const attrName = elementIsScrollable(element) ? 'v-scroll-id' : V_ID_ATTR_NAME;
    const elementRect = getElementRectClone(element);
    // add offset if the element is inside an iframe
    if (element.iframeOwner) {
      const iframeRect = element.iframeOwner.getBoundingClientRect();
      elementRect.top += iframeRect.top;
      elementRect.left += iframeRect.left;
    }
    const id = getSequenceFromNum(hintId);
    element.setAttribute(attrName, id);
    const span = document.createElement('span');
    span.setAttribute('class', 'vision-hint');
    span.innerText = id;
    span.setAttribute('style',
      `   top: ${elementRect.top}px; 
          left: ${elementRect.left}px; 
          position: fixed; 
          background-color: ${color} !important;`
    );
    //document.querySelector('body').after(span);
    dialog.appendChild(span);
    const attrs = getElementsAttrs(element);
    // traverse the attributes and create the xml map
    let xmlAttrs = '';
    for (const [key, value] of Object.entries(attrs)) {
      if (value && key !== 'interactionType') {
        xmlAttrs += ` ${key}="${value}"`;
      }
    }
    xmlMap += `<${attrs.interactionType.toLowerCase()}${xmlAttrs}/>`;
    // create an sqquare in the position and size of the element
    const square = document.createElement('div');

    square.setAttribute('style',
      `   top: ${elementRect.top}px; 
          left: ${elementRect.left}px; 
          width: ${elementRect.width}px; 
          height: ${elementRect.height}px; 
          border: dashed 2px ${color};`
    )
    square.classList.add('vision-segment');

    dialog.appendChild(square);
    jsonMap[id] = elementRect;
    if(elementIsScrollable(element)){
      jsonMap[id].scrolled = element.scrollTop;
      jsonMap[id].scrollHeight = element.scrollHeight;
    }
    hintId++;
  });

  
  window.xmlMap = xmlMap;

  document.body.appendChild(dialog);
  dialog.showModal();
  window.jsonMap = jsonMap;
}
window.removeSom = () => {
  const dialog = document.getElementById('vision-dialog');
  if (dialog) {
    dialog.close();
    dialog.remove();
  }
}
window.som();